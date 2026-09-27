const {hasScheduledDateRange}=require('../domain/task-dates.mjs');
const {POLICY_KEY,createAgentWorkMaintenance}=require('./agent-work-maintenance.cjs');
const { domainService, fail } = require('./agent-work-contract.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { migrateAgentWork, STORAGE_KEY } = require('./agent-work-migration.cjs');
const { createAgentWorkRepository } = require('./agent-work-repository.cjs');

const eventNormalizer = domainService();
const defined = value => Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined && v!==null));
const identifier = value => typeof value==='string' && value.length<=160 && /^[a-zA-Z0-9._:/-]+$/.test(value) && !/(?:https?:|bearer|secret|password|token=)/i.test(value) ? value : undefined;
function publicBinding(binding) {
  if(!binding) return binding;
  const {opaqueSessionRef,mcpGrantId,workspacePath,...safe}=binding;
  return safe;
}
function publicResult(result) {
  if(!result || typeof result!=='object') return result;
  return {...result,...(result.binding?{binding:publicBinding(result.binding)}:{}),...(result.bindings?{bindings:result.bindings.map(publicBinding)}:{})};
}
function eventInput(input) {
  // Native envelopes are transient. Only explicitly selected structural facts reach the repository.
  const result={};
  for(const key of ['id','bindingId','runtimeProfileId','turnId','idempotencyKey','kind','sourceProtocol','nativeEventType','observedAt']) if(input[key]!==undefined) result[key]=input[key];
  for(const key of ['state','requestId','capabilityId','permissionState','currency','usageAggregation']) {
    const value=identifier(typeof input[key]==='number'?String(input[key]):input[key]);
    if(value!==undefined) result[key]=value;
  }
  if(result.kind==='session' && !String(result.nativeEventType||'').startsWith('omvra/')) result.kind='observation';
  if(['completed','failed','interrupted','cancelled','closed','process-exit','runtime-missing','protocol-error'].includes(input.outcome)) result.outcome=input.outcome;
  for(const key of ['inputTokens','outputTokens','totalTokens','contextTokens','cost']) if(Number.isFinite(input[key]) && input[key]>=0) result[key]=input[key];
  return result;
}
function eventProjection(row,binding) {
  return {schemaVersion:1,id:row.id,bindingId:row.session_id,runtimeProfileId:binding.runtimeProfileId,turnId:row.turn_id||undefined,type:row.kind,nativeEventType:row.native_type,observedAt:new Date(row.observed_at).toISOString(),...JSON.parse(row.facts_json),summary:row.summary,seq:row.seq,origin:'native-runtime',dispatchEligible:false};
}
function createAgentWorkSessionService({repository,store,attachBindingToAttempt,appendTaskContext,readTasks}) {
  const project = (snapshot,tasks) => {
    const b=snapshot.binding;
    const task=b.scope.kind==='task'?(tasks ?? readTasks(store)).find(task=>task?.id===b.scope.taskId):null;
    const turnState=b.turn?.state;
    const state=task?.status==='done'?'complete':task?.status==='under-review'?'ready-for-review':b.state==='interrupted'?'interrupted':({queued:'starting',starting:'starting',active:'working','waiting-input':'waiting',cancelling:'stopping',completed:'batch-finished',failed:'failed',interrupted:'interrupted'}[turnState]||({closed:'stopped',failed:'failed',interrupted:'interrupted',ready:'ready',starting:'starting'}[b.state]));
    return {...b,attentionState:snapshot.session.attention_state,latestSummary:snapshot.turn?.final_summary||snapshot.projection?.latest_summary||null,snapshotVersion:snapshot.session.snapshot_version,historyIncomplete:Boolean(JSON.parse(snapshot.session.governance_json).historyIncomplete),recoveryRequired:Boolean(snapshot.session.recovery_required),...(b.scope.kind==='task'?{taskAvailable:Boolean(task),unscheduled:task? !hasScheduledDateRange(task) : null,taskExecution:{schemaVersion:1,state,updatedAt:b.updatedAt,...(b.turn?{turnId:b.turn.id,turnState}: {})}}:{})};
  };
  const load=async id=>project(await repository.snapshot({bindingId:id,limit:1}));
  async function list(_store,input={}) {
    const limit=Math.max(1,Math.min(100,Number(input.limit)||50));
    if(input.bindingId) {
      let s;
      try { s=await repository.snapshot({bindingId:input.bindingId,limit}); }
      catch(error) { if(error.code==='ACP_SESSION_NOT_FOUND') return {ok:true,bindings:[],events:[],hasMore:false};throw error; }
      return {ok:true,bindings:[project(s)],events:input.includeEvents===false?[]:s.events.map(e=>eventProjection(e,s.binding)),hasMore:input.includeEvents===false?false:s.hasMore,notifications:s.notifications};
    }
    const result=await repository.listSessions(defined({limit,taskId:input.taskId,activeOnly:input.activeOnly===true,recent:true}));
    const snapshots=[];
    for(const b of result.sessions) snapshots.push(await repository.snapshot({bindingId:b.id,limit:1}));
    // Read current task authority once, after asynchronous history reads. Never cache across requests.
    const tasks=snapshots.some(s=>s.binding.scope.kind==='task')?readTasks(store):[];
    const bindings=snapshots.map(s=>project(s,tasks));
    return {ok:true,bindings,events:[],hasMore:result.hasMore};
  }
  async function createBinding(_store,input) {
    const {extensions,mcpGrantId,...safe}=input;
    // Existing extension is launch-only; unknown extensions must never silently become durable.
    if(extensions && Object.keys(extensions).some(key=>key!=='workspacePath')) fail('INVALID_AGENT_WORK_INPUT');
    const result=await repository.createSession(safe);
    const attached=attachBindingToAttempt(store,result.binding);
    if(!attached.ok) return {...attached,binding:result.binding,reconciliationRequired:true};
    return {...result,binding:await load(result.binding.id)};
  }
  async function updateBinding(_store,input) {
    if(['completed','failed','interrupted'].includes(input.turn?.state)) {
      const result=await repository.completeTurn({bindingId:input.bindingId,expectedRevision:input.expectedRevision,turnId:input.turn.id,outcome:input.turn.state,idempotencyKey:`completion:${input.turn.id}:${input.turn.state}`});
      return {ok:true,binding:project(result.snapshot),notification:result.notification};
    }
    const result=await repository.updateSession({...input,...(['closed','failed'].includes(input.state)?{recoveryRequired:false}:{})});
    return {...result,binding:await load(input.bindingId)};
  }
  async function appendEvent(_store,input) {
    const result=await repository.appendEvent(eventInput(input));
    const transient=eventNormalizer.normalizeEvent(input).event || {};
    const live=defined(Object.fromEntries(['messagePreview','providerDetail','failureClass','toolName'].map(key=>[key,transient[key]])));
    return {ok:true,...result,...(result.event?{event:{...eventProjection(result.event,{runtimeProfileId:input.runtimeProfileId}),...live}}:{})};
  }
  async function appendDurableOutcome(_store,input) {
    const binding=(await repository.snapshot({bindingId:input.bindingId,limit:1})).binding;
    return domainService({readBindings:()=>[binding],appendTaskContext}).appendDurableOutcome(store,input);
  }
  async function evaluateGovernance(_store,input) {
    const data=await repository.governance({bindingId:input.bindingId});
    return domainService({readBindings:()=>[data.binding],readGovernance:()=>data}).evaluateGovernance(store,input);
  }
  async function prepareArchive(_store,bindingId) {
    const binding=await load(bindingId);
    if(binding.state==='starting'||['queued','starting','active','waiting-input','cancelling'].includes(binding.turn?.state)) return {ok:false,error:'ACP_SESSION_ACTIVE'};
    if(!binding.opaqueSessionRef && !binding.recoveryRequired) return {ok:true,binding,changed:false};
    return {...await updateBinding(store,{bindingId,expectedRevision:binding.revision,state:'closed',terminalReason:'closed',opaqueSessionRef:''}),changed:true};
  }
  const maintenance=createAgentWorkMaintenance({repository,store});
  return {maintenance,createBinding,updateBinding,appendEvent,list,appendDurableOutcome,evaluateGovernance,prepareArchive,reconcileInterrupted:()=>list(store,{includeEvents:false}),close:async()=>{await maintenance.close();await repository.close();}};
}
async function openAgentWorkSessionService(options) {
  if(options.store.get(STORAGE_KEY)) {
    const file=path.join(path.dirname(options.store.path),path.basename(options.store.path,path.extname(options.store.path)),'agent-work-v1.sqlite');
    const stat=await fs.stat(file).catch(()=>null);
    if(!stat?.isFile() || !stat.size) fail('AGENT_WORK_DATABASE_MISSING');
  }
  const repository=await createAgentWorkRepository({storePath:options.store.path,policy:options.store.get(POLICY_KEY),maintenanceSuspended:true});
  try {await migrateAgentWork({store:options.store,repository});return createAgentWorkSessionService({...options,repository});}
  catch(error){await repository.close().catch(()=>{});throw error;}
}
module.exports={createAgentWorkSessionService,openAgentWorkSessionService,eventInput,eventProjection,publicBinding,publicResult};
