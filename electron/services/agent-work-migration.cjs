const fs = require('node:fs/promises');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { createHash } = require('node:crypto');
const { normalizeCommand, DEFAULT_POLICY, fail, migrationIdentity } = require('./agent-work-contract.cjs');
const { SESSION_BINDINGS_KEY, SESSION_EVENTS_KEY } = require('../domain/agent-runtime-session-service.cjs');

const STORAGE_KEY = 'omvra.agentWorkStorage.v1';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const defined = value => Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined && v!==null));
const fields = (value, allowed, excluded, counts) => {
  for (const key of Object.keys(value)) {
    if (excluded.includes(key)) counts[key]=(counts[key]||0)+1;
    else if (!allowed.includes(key)) fail('AGENT_WORK_MIGRATION_UNKNOWN_FIELD');
  }
};
function migrationPlan(source) {
  if (!Array.isArray(source.bindings) || !Array.isArray(source.events)) fail('AGENT_WORK_MIGRATION_INVALID_SOURCE');
  if (source.events.length>DEFAULT_POLICY.events || source.bindings.length>DEFAULT_POLICY.sessions*10) fail('AGENT_WORK_MIGRATION_CAPACITY');
  const exclusions={};
  const sessions=source.bindings.map(b=>{
    fields(b,['schemaVersion','id','revision','idempotencyKey','runtimeProfileId','scope','state','capabilities','createdAt','updatedAt','lastObservedAt','opaqueSessionRef','terminalReason','turn'],['workspacePath','mcpGrantId','closedAt'],exclusions);
    const {workspacePath,mcpGrantId,closedAt,...safe}=b;
    if (safe.turn) {
      fields(safe.turn,['schemaVersion','id','state','requestId','createdAt','updatedAt','startedAt','finishedAt','terminalReason'],[],exclusions);
      safe.turn={...safe.turn};delete safe.turn.schemaVersion;
      if(['queued','starting','active','waiting-input','cancelling'].includes(safe.turn.state)) {
        delete safe.turn.requestId;
        safe.turn.state='interrupted'; safe.turn.finishedAt=safe.updatedAt; safe.turn.terminalReason='process-exit';
        exclusions.recoveredTurns=(exclusions.recoveredTurns||0)+1;
      }
    }
    if(['starting','ready','active','needs-input','cancelling'].includes(safe.state)) {
      safe.state='interrupted';safe.terminalReason='process-exit';
      exclusions.recoveredSessions=(exclusions.recoveredSessions||0)+1;
    }
    if(['closed','failed'].includes(safe.state) && safe.opaqueSessionRef) { delete safe.opaqueSessionRef;exclusions.closedProviderReferences=(exclusions.closedProviderReferences||0)+1; }
    const normalized=normalizeCommand('migrationSession',{binding:safe,digest:'pending'});
    normalized.digest=digest(migrationIdentity(normalized.binding));
    return normalized;
  });
  const byId=new Map(sessions.map(s=>[s.binding.id,s]));
  if(byId.size!==sessions.length) fail('AGENT_WORK_MIGRATION_DUPLICATE');
  const seqs=new Map(),ids=new Set();
  const events=source.events.map(e=>{
    fields(e,['schemaVersion','id','bindingId','runtimeProfileId','type','sourceKind','sourceProtocol','nativeEventType','origin','dispatchEligible','observedAt','startedAt','finishedAt','durationMs','state','outcome','requestId','turnId','capabilityId','permission','usage','failureClass','idempotencyKey','scope','workScope','sourceRevision','taskId','contributionId','executionAttemptId','taskRevision','goalId','goalElementId','goalExecutionId','executionAttempt','goalRevision'],['messagePreview','providerDetail','errorDetail','toolName'],exclusions);
    if(e.usage) fields(e.usage,['provenance','optional','aggregation','inputTokens','outputTokens','totalTokens','contextTokens','cost','currency'],[],exclusions);
    if(e.permission) fields(e.permission,['authority','state','capabilityId'],[],exclusions);
    const s=byId.get(e.bindingId);
    if(!s || s.binding.runtimeProfileId!==e.runtimeProfileId) fail('AGENT_WORK_MIGRATION_ORPHAN_EVENT');
    for(const key of ['taskId','contributionId','executionAttemptId','goalId','goalElementId','goalExecutionId','executionAttempt']) if(e[key]!==undefined && e[key]!==s.binding.scope[key]) fail('AGENT_WORK_MIGRATION_SCOPE_MISMATCH');
    if(ids.has(e.id)) fail('AGENT_WORK_MIGRATION_DUPLICATE');
    ids.add(e.id);
    const seq=(seqs.get(e.bindingId)||0)+1;seqs.set(e.bindingId,seq);
    if(seq>DEFAULT_POLICY.eventsPerSession) fail('AGENT_WORK_MIGRATION_CAPACITY');
    // Legacy outcomes sometimes contain provider prose. Preserve only the structural lifecycle enum.
    const outcome=['completed','failed','interrupted','cancelled','closed','process-exit','runtime-missing','protocol-error'].includes(e.outcome)?e.outcome:undefined;
    if(e.outcome && outcome===undefined) exclusions.outcomeText=(exclusions.outcomeText||0)+1;
    const input=defined({id:e.id,bindingId:e.bindingId,runtimeProfileId:e.runtimeProfileId,turnId:e.turnId,seq,idempotencyKey:e.idempotencyKey||`migration:${e.id}`,kind:e.sourceKind,sourceProtocol:e.sourceProtocol,nativeEventType:e.nativeEventType,observedAt:e.observedAt,state:e.state,outcome,requestId:e.requestId,capabilityId:e.capabilityId,permissionState:e.permission?.state,...defined(e.usage?{inputTokens:e.usage.inputTokens,outputTokens:e.usage.outputTokens,totalTokens:e.usage.totalTokens,contextTokens:e.usage.contextTokens,cost:e.usage.cost,currency:e.usage.currency,usageAggregation:e.usage.aggregation}:{})});
    const normalized=normalizeCommand('appendEvent',input);
    return {input,normalized};
  });
  const sessionHash=createHash('sha256'),eventHash=createHash('sha256');
  for(const s of [...sessions].sort((a,b)=>a.binding.id<b.binding.id?-1:1)) sessionHash.update(JSON.stringify([s.binding.id,s.digest])+'\n');
  for(const {normalized:e} of [...events].sort((a,b)=>a.normalized.bindingId<b.normalized.bindingId?-1:a.normalized.bindingId>b.normalized.bindingId?1:a.normalized.seq-b.normalized.seq)) {
    const facts={};for(const key of ['state','outcome','requestId','capabilityId','permission','usage','failureClass','sourceProtocol']) if(e[key]!==undefined) facts[key]=e[key];
    eventHash.update(JSON.stringify([e.id,e.bindingId,e.turnId||null,e.seq,e.idempotencyKey,e.type,e.nativeEventType,Date.parse(e.observedAt),JSON.stringify(facts)])+'\n');
  }
  return {sessions,events,exclusions,verification:{sessions:sessions.length,events:events.length,sessionDigest:sessionHash.digest('hex'),eventDigest:eventHash.digest('hex')}};
}
async function writeProtected(file,value) {
  const temporary=`${file}.pending`;
  const handle=await fs.open(temporary,'w',0o600);
  try { await handle.writeFile(JSON.stringify(value));await handle.sync(); } finally {await handle.close();}
  await fs.rename(temporary,file);
  const directory=await fs.open(path.dirname(file),'r');try {await directory.sync();}finally{await directory.close();}
}
/** Run only while the owner has suspended all runtime readers/writers. Never touches task records. */
async function migrateAgentWork({store,repository}) {
  const directory=path.join(path.dirname(store.path),path.basename(store.path,path.extname(store.path)));
  const manifestPath=path.join(directory,'migration-v1.json');
  const backupPath=path.join(directory,'migration-source-v1.json');
  let manifest;try {manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const marker=store.get(STORAGE_KEY);
  if(marker) {
    if(marker.schemaVersion!==1 || marker.phase!=='sqlite' || manifest?.phase!=='verified' || marker.fingerprint!==manifest.fingerprint) fail('AGENT_WORK_MIGRATION_AUTHORITY_CONFLICT');
    if((store.get(SESSION_BINDINGS_KEY)||[]).length || (store.get(SESSION_EVENTS_KEY)||[]).length) fail('AGENT_WORK_LEGACY_WRITER_DETECTED');
    if(Date.now()-Date.parse(manifest.verifiedAt)>7*86400000) await fs.rm(backupPath,{force:true});
    repository.resumeMaintenance();return manifest;
  }
  const source={bindings:store.get(SESSION_BINDINGS_KEY)||[],events:store.get(SESSION_EVENTS_KEY)||[]};
  const fingerprint=digest(source);
  if(manifest && manifest.fingerprint!==fingerprint) fail('AGENT_WORK_MIGRATION_SOURCE_CHANGED');
  const plan=migrationPlan(source);
  await fs.mkdir(directory,{recursive:true,mode:0o700});
  if(!manifest) {
    await writeProtected(backupPath,{schemaVersion:1,fingerprint,source});
    manifest={schemaVersion:1,phase:'importing',fingerprint,sourceCounts:{sessions:source.bindings.length,events:source.events.length},exclusions:plan.exclusions,verification:plan.verification};
    await writeProtected(manifestPath,manifest);
  } else {
    const backup=JSON.parse(await fs.readFile(backupPath,'utf8'));
    if(digest(backup.source)!==fingerprint) fail('AGENT_WORK_MIGRATION_BACKUP_CHANGED');
  }
  for(const s of plan.sessions) await repository.migrationSession(s);
  for(const e of plan.events) await repository.migrationEvent({event:e.input});
  for(const s of plan.sessions) await repository.migrationFinalize({bindingId:s.binding.id});
  const verification=await repository.migrationVerify();
  if(!isDeepStrictEqual(verification,plan.verification)) fail('AGENT_WORK_MIGRATION_VERIFICATION_FAILED');
  manifest={...manifest,phase:'verified',verifiedAt:new Date().toISOString(),verification};
  await writeProtected(manifestPath,manifest);
  if(digest({bindings:store.get(SESSION_BINDINGS_KEY)||[],events:store.get(SESSION_EVENTS_KEY)||[]})!==fingerprint) fail('AGENT_WORK_MIGRATION_SOURCE_CHANGED');
  // electron-store's multi-key set commits one complete JSON snapshot atomically.
  store.set({[STORAGE_KEY]:{schemaVersion:1,phase:'sqlite',fingerprint},[SESSION_BINDINGS_KEY]:[],[SESSION_EVENTS_KEY]:[]});
  repository.resumeMaintenance();
  return manifest;
}
module.exports={STORAGE_KEY,migrationPlan,migrateAgentWork};
