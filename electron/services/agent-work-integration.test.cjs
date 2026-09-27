const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {createAgentWorkRepository}=require('./agent-work-repository.cjs');
const {domainService}=require('./agent-work-contract.cjs');
const {migrateAgentWork,STORAGE_KEY}=require('./agent-work-migration.cjs');
const {createAgentWorkSessionService,publicResult}=require('./agent-work-session-service.cjs');
const {createAgentRuntimeSessionRunner}=require('./agent-runtime-session-runner.cjs');
const {SESSION_BINDINGS_KEY,SESSION_EVENTS_KEY}=require('../domain/agent-runtime-session-service.cjs');
async function fixture(t) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'omvra-agent-integration-'));
  const values=new Map(),writes=[];
  const store={path:path.join(directory,'workspace.json'),get:key=>structuredClone(values.get(key)),set:(key,value)=>{if(typeof key==='object'){for(const [k,v] of Object.entries(key)){values.set(k,structuredClone(v));writes.push(k);}}else {values.set(key,structuredClone(value));writes.push(key);}}};
  const f={directory,store,writes,repo:await createAgentWorkRepository({storePath:store.path,maintenanceSuspended:true})};
  t.after(async()=>{await f.repo.close().catch(()=>{});await fs.rm(directory,{recursive:true,force:true});});
  f.reopen=async()=>{await f.repo.close();f.repo=await createAgentWorkRepository({storePath:store.path,maintenanceSuspended:true});};
  return f;
}
function legacy(f) {
  const domain=domainService({readBindings:()=>f.store.get(SESSION_BINDINGS_KEY)||[],writeBindings:(_,v)=>f.store.set(SESSION_BINDINGS_KEY,v),readEvents:()=>f.store.get(SESSION_EVENTS_KEY)||[],writeEvents:(_,v)=>f.store.set(SESSION_EVENTS_KEY,v)});
  const b=domain.createBinding(null,{runtimeProfileId:'runtime-1',scope:{kind:'task',taskId:'task-1',executionAttemptId:'attempt-1',taskRevision:4},idempotencyKey:'session-1',turn:{id:'turn-1',state:'active'},extensions:{workspacePath:'/private/provider'}}).binding;
  domain.updateBinding(null,{bindingId:b.id,expectedRevision:b.revision,state:'ready',opaqueSessionRef:'provider-thread-1'});
  domain.appendEvent(null,{bindingId:b.id,runtimeProfileId:b.runtimeProfileId,turnId:'historical-turn',kind:'message',messagePreview:'PRIVATE_MODEL_TEXT',providerDetail:'PRIVATE_ERROR_TEXT',idempotencyKey:'old-event'});
  domain.appendEvent(null,{bindingId:b.id,runtimeProfileId:b.runtimeProfileId,turnId:'turn-1',kind:'tool',idempotencyKey:'tool-event'});
  return b;
}
test('session list reads the workspace once and refreshes task authority on the next request',async t=>{
  const f=await fixture(t),Conf=require('conf');
  let reads=0;
  const store=new Conf({cwd:f.directory,configName:'projection-workspace',deserialize:text=>{reads++;return JSON.parse(text);}});
  store.set('omvra.tasks.v1',Array.from({length:100},(_,i)=>({id:`task-${i}`,status:'in-progress',notes:'x'.repeat(37000)})));
  for(let i=0;i<100;i++) await f.repo.createSession({runtimeProfileId:'runtime-1',scope:{kind:'task',taskId:`task-${i}`,executionAttemptId:`attempt-${i}`,taskRevision:0},idempotencyKey:`session-${i}`});
  const service=createAgentWorkSessionService({repository:f.repo,store,readTasks:s=>s.get('omvra.tasks.v1')});
  reads=0;
  const started=performance.now();
  const first=await service.list(store,{limit:100,includeEvents:false});
  t.diagnostic(JSON.stringify({sessions:first.bindings.length,workspaceReads:reads,listMs:performance.now()-started}));
  assert.equal(first.bindings.length,100);
  assert.equal(reads,1);
  assert.ok(first.bindings.every(b=>b.taskAvailable && b.unscheduled));
  store.set('omvra.tasks.v1',[{id:'task-0',status:'done',startDate:'2026-09-27',endDate:'2026-09-28'}]);
  reads=0;
  const second=await service.list(store,{limit:100,includeEvents:false});
  assert.equal(reads,1);
  const current=second.bindings.find(b=>b.scope.taskId==='task-0');
  assert.equal(current.taskExecution.state,'complete');
  assert.equal(current.unscheduled,false);
  assert.equal(second.bindings.filter(b=>!b.taskAvailable).length,99);
});
test('migration retries after partial import, verifies history, recovers attention and never writes task authority',async t=>{
  const f=await fixture(t),b=legacy(f);
  const task={id:'task-1',status:'open',__mcpRevision:4,dependencies:['task-other'],archivedAt:null};
  f.store.set('omvra.tasks.v1',[task]);
  const source=structuredClone([f.store.get(SESSION_BINDINGS_KEY),f.store.get(SESSION_EVENTS_KEY)]);
  let imports=0;
  const interrupted={...f.repo,migrationEvent:async input=>{if(++imports===2) throw Object.assign(new Error('TEST_INTERRUPTION'),{code:'TEST_INTERRUPTION'});return f.repo.migrationEvent(input);}};
  await assert.rejects(migrateAgentWork({store:f.store,repository:interrupted}),{code:'TEST_INTERRUPTION'});
  assert.equal(f.store.get(STORAGE_KEY),undefined);
  assert.deepEqual([f.store.get(SESSION_BINDINGS_KEY),f.store.get(SESSION_EVENTS_KEY)],source);
  await f.reopen();
  const writeCount=f.writes.length;
  const manifest=await migrateAgentWork({store:f.store,repository:f.repo});
  assert.equal(manifest.verification.events,2);
  assert.equal(manifest.exclusions.messagePreview,1);
  assert.equal(manifest.exclusions.recoveredTurns,1);
  assert.deepEqual(f.writes.slice(writeCount).sort(),[STORAGE_KEY,SESSION_BINDINGS_KEY,SESSION_EVENTS_KEY].sort());
  assert.deepEqual(f.store.get('omvra.tasks.v1'),[task]);
  const snapshot=await f.repo.snapshot({bindingId:b.id});
  assert.equal(snapshot.binding.state,'interrupted');assert.equal(snapshot.turn.state,'interrupted');
  assert.equal(snapshot.session.attention_state,'interrupted');assert.equal(snapshot.binding.opaqueSessionRef,'provider-thread-1');
  assert.equal(snapshot.events.length,2);assert.deepEqual(snapshot.events.map(e=>e.seq),[1,2]);
  assert.equal(JSON.stringify(snapshot).includes('PRIVATE_'),false);
  assert.equal(snapshot.binding.turn.id,'turn-1');
  assert.match(snapshot.turn.final_summary,/historical output was not imported/);
  const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>f.store.get('omvra.tasks.v1'),attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
  let result=await service.list(f.store,{bindingId:b.id});
  assert.equal(result.bindings[0].unscheduled,true);
  assert.equal(publicResult(result).bindings[0].opaqueSessionRef,undefined);
  f.store.set('omvra.tasks.v1',[{...task,startDate:'2026-09-25',endDate:'2026-09-26',status:'under-review'}]);
  result=await service.list(f.store,{bindingId:b.id});
  assert.equal(result.bindings[0].unscheduled,false);assert.equal(result.bindings[0].taskExecution.state,'ready-for-review');
  await f.reopen();
  await migrateAgentWork({store:f.store,repository:f.repo});
  assert.equal((await f.repo.metrics()).counts.events,2);
});
test('migration rejects unknown fields and changed legacy writers without cutting over',async t=>{
  const f=await fixture(t);legacy(f);
  f.store.set(SESSION_BINDINGS_KEY,f.store.get(SESSION_BINDINGS_KEY).map(b=>({...b,unknownExtension:'not-discarded'})));
  await assert.rejects(migrateAgentWork({store:f.store,repository:f.repo}),{code:'AGENT_WORK_MIGRATION_UNKNOWN_FIELD'});
  assert.equal(f.store.get(STORAGE_KEY),undefined);
  assert.equal((await f.repo.metrics()).counts.sessions,0);
});
test('runner completion waits for the committed projection; failure publishes no finished state',async t=>{
  const f=await fixture(t);
  const task={id:'task-1',status:'in-progress'};
  const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>[task],attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
  let b=(await service.createBinding(f.store,{runtimeProfileId:'runtime-1',scope:{kind:'task',taskId:task.id,executionAttemptId:'attempt-1',taskRevision:0},idempotencyKey:'session-1'})).binding;
  b=(await service.updateBinding(f.store,{bindingId:b.id,expectedRevision:b.revision,state:'interrupted',opaqueSessionRef:'provider-thread-1'})).binding;
  let notify,releaseCommit;const emitted=[];
  const gate=new Promise(resolve=>{releaseCommit=resolve;});
  const runner=createAgentRuntimeSessionRunner({store:f.store,resolveProfile:()=>({ok:true,profile:{id:'runtime-1'}}),confirmStart:()=>({canStart:false}),transitionContribution:()=>({ok:true}),createBinding:service.createBinding,listSessions:service.list,appendEvent:service.appendEvent,updateBinding:async(store,input)=>{if(input.turn?.state==='completed')await gate;return service.updateBinding(store,input);},emitRuntimeEvent:value=>emitted.push(value),createClient:()=>({initialize:async()=>({capabilities:{resume:true}}),resumeSession:async()=>({sessionId:'provider-thread-1'}),prompt:async()=>({}),onNotification:callback=>{notify=callback;},close:()=>{}})});
  await runner.resume(b.id,{workspacePath:'/tmp/workspace'});
  await notify({method:'turn/started',params:{}});
  const finishing=notify({method:'turn/completed',params:{turn:{status:'completed'}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(emitted.some(e=>e.binding?.turn?.state==='completed'),false);
  assert.equal((await f.repo.snapshot({bindingId:b.id})).turn.state,'active');
  releaseCommit();await finishing;
  const completed=emitted.find(e=>e.binding?.turn?.state==='completed');
  assert.ok(completed);assert.match(completed.binding.latestSummary,/Turn completed/);
  assert.equal((await f.repo.snapshot({bindingId:b.id})).projection.latest_state,'completed');
  await runner.continueTask(b.id);
  const db=new DatabaseSync(path.join(f.directory,'workspace','agent-work-v1.sqlite'));
  db.exec("CREATE TRIGGER reject_completion BEFORE INSERT ON agent_notifications BEGIN SELECT RAISE(ABORT,'test'); END");db.close();
  const previous=emitted.length;
  await notify({method:'turn/completed',params:{turn:{status:'completed'}}});
  assert.equal(emitted.slice(previous).some(e=>e.binding?.turn?.state==='completed'),false);
  assert.ok(emitted.slice(previous).some(e=>e.kind==='storage-failure'));
  assert.equal((await f.repo.snapshot({bindingId:b.id})).turn.state,'starting');
  assert.equal(task.status,'in-progress');
  await runner.dispose();
});
test('cutover detects a revived legacy writer and a missing database instead of reopening JSON authority',async t=>{
  const f=await fixture(t);legacy(f);
  await migrateAgentWork({store:f.store,repository:f.repo});
  f.store.set(SESSION_EVENTS_KEY,[{id:'stale-writer'}]);
  await assert.rejects(migrateAgentWork({store:f.store,repository:f.repo}),{code:'AGENT_WORK_LEGACY_WRITER_DETECTED'});
  f.store.set(SESSION_EVENTS_KEY,[]);
  await f.repo.close();
  const database=path.join(f.directory,'workspace','agent-work-v1.sqlite');
  await fs.rm(database);
  const {openAgentWorkSessionService}=require('./agent-work-session-service.cjs');
  await assert.rejects(openAgentWorkSessionService({store:f.store}),{code:'AGENT_WORK_DATABASE_MISSING'});
  await assert.rejects(fs.stat(database),{code:'ENOENT'});
});
test('store IPC rejects retired history writes before workspace restore can partially apply',async t=>{
  const f=await fixture(t);
  const {registerStoreIpcHandlers}=require('../ipc/store.cjs');
  const handlers=new Map();
  registerStoreIpcHandlers({ipcMain:{handle:(key,fn)=>handlers.set(key,fn)},store:f.store,agentWorkManaged:true});
  f.store.set('omvra.tasks.v1',[{id:'original'}]);
  for(const key of [SESSION_BINDINGS_KEY,SESSION_EVENTS_KEY,STORAGE_KEY,'omvra']) assert.throws(()=>handlers.get('store/set')(null,key,[]),{code:'AGENT_WORK_LEGACY_WRITE_FORBIDDEN'});
  assert.throws(()=>handlers.get('store/set-many')(null,{'omvra.tasks.v1':[],[SESSION_BINDINGS_KEY]:[]}),{code:'AGENT_WORK_LEGACY_WRITE_FORBIDDEN'});
  assert.deepEqual(f.store.get('omvra.tasks.v1'),[{id:'original'}]);
});
test('workspace facade cuts over together and keeps a ready session attached to its governed attempt',async t=>{
  const f=await fixture(t);await f.repo.close();
  const workspace=require('./workspace-service.cjs');
  const task={id:'task-1',title:'Unscheduled task',status:'in-progress',__mcpRevision:4,collaboration:{schemaVersion:1,orchestratorId:'arc',contributions:[{id:'contribution-1',personId:'edgar',role:'subagent',scope:'implementation',state:'working',latestAttemptId:'attempt-1'}]}};
  f.store.set('omvra.tasks.v1',[task]);
  f.store.set(workspace.TASK_CONTRIBUTION_ATTEMPTS_KEY,[{id:'attempt-1',taskId:'task-1',contributionId:'contribution-1',state:'working'}]);
  const owner=await workspace.initializeAgentWorkStorage(f.store);
  try {
    let b=(await workspace.createAgentRuntimeSessionBinding(f.store,{runtimeProfileId:'runtime-1',scope:{kind:'task',taskId:'task-1',contributionId:'contribution-1',executionAttemptId:'attempt-1',taskRevision:4},idempotencyKey:'facade-session'})).binding;
    b=(await workspace.updateAgentRuntimeSessionBinding(f.store,{bindingId:b.id,expectedRevision:b.revision,state:'ready',opaqueSessionRef:'provider-thread'})).binding;
    assert.equal(f.store.get(workspace.TASK_CONTRIBUTION_ATTEMPTS_KEY)[0].sessionBindingId,b.id);
    assert.equal(f.store.get(SESSION_BINDINGS_KEY).length,0);
    const recovered=await workspace.recoverOrphanedTaskExecution(f.store,{taskId:'task-1'});
    assert.equal(recovered.changed,false);assert.equal(recovered.binding.id,b.id);
    assert.deepEqual(f.store.get('omvra.tasks.v1'),[task]);
    assert.equal((await workspace.listAgentRuntimeSessions(f.store,{bindingId:b.id})).bindings[0].unscheduled,true);
    const closed=await workspace.updateAgentRuntimeSessionBinding(f.store,{bindingId:b.id,expectedRevision:b.revision,state:'closed'});
    assert.equal(closed.binding.recoveryRequired,false);
    assert.equal(closed.binding.opaqueSessionRef,undefined);
  } finally {await owner.close();}
});
test('migration verifies destination fields, not merely source digest labels',async t=>{
  const f=await fixture(t);legacy(f);
  const wrapped={...f.repo,migrationVerify:async()=>{
    const db=new DatabaseSync(path.join(f.directory,'workspace','agent-work-v1.sqlite'));
    db.exec('UPDATE agent_sessions SET source_revision=source_revision+1');db.close();
    return f.repo.migrationVerify();
  }};
  await assert.rejects(migrateAgentWork({store:f.store,repository:wrapped}),{code:'AGENT_WORK_MIGRATION_VERIFICATION_FAILED'});
  assert.equal(f.store.get(STORAGE_KEY),undefined);
  assert.equal(f.store.get(SESSION_BINDINGS_KEY).length,1);
});

test('real SQLite starts accept absent or present contribution IDs and failed binding writes retire direct attempts',async t=>{
  for(const contributionId of [null,undefined,'contribution-1']) {
    const f=await fixture(t),task={id:'task-1',status:'in-progress',__mcpRevision:4};
    const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>[task],attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
    let initialized=0,notify;
    const runner=createAgentRuntimeSessionRunner({store:f.store,resolveProfile:()=>({ok:true,profile:{id:'runtime-1'}}),
      confirmStart:()=>({ok:true,canStart:true,task,attempt:contributionId?{id:'attempt-1'}:null,contractSnapshot:{taskId:task.id,taskRevision:4,contributionId},contractDigest:'digest'}),
      transitionContribution:()=>({ok:true,task}),createBinding:service.createBinding,listSessions:service.list,appendEvent:service.appendEvent,updateBinding:service.updateBinding,
      createClient:()=>({initialize:async()=>{initialized++;return {capabilities:{}};},startSession:async()=>({sessionId:'provider-thread'}),prompt:async()=>({}),onNotification:cb=>{notify=cb;},close:()=>{}})});
    try {
      const result=await runner.start({confirmed:true,taskId:task.id,workspacePath:'/tmp/workspace',idempotencyKey:'start-1'});
      assert.equal(result.ok,true);assert.equal(initialized,1);
      assert.equal(result.binding.scope.contributionId,contributionId||undefined);
      assert.equal(result.binding.unscheduled,true);
      await notify({method:'turn/completed',params:{turn:{status:'completed'}}});
      assert.deepEqual(task,{id:'task-1',status:'in-progress',__mcpRevision:4},'runtime completion cannot accept or date the task');
    } finally {await runner.dispose();}
  }
  const f=await fixture(t);
  const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>[{id:'task-1'}],attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
  for(const returnedFailure of [false,true]) {
    const runner=createAgentRuntimeSessionRunner({store:f.store,resolveProfile:()=>({ok:true,profile:{id:'runtime-1'}}),
      confirmStart:()=>({canStart:true,task:{__mcpRevision:4},contractSnapshot:{taskId:'task-1',taskRevision:4,contributionId:null}}),
      transitionContribution:()=>({ok:true}),listSessions:service.list,appendEvent:service.appendEvent,updateBinding:service.updateBinding,
      createBinding:async()=>{if(returnedFailure)return {ok:false,error:'SQLITE_BUSY'};throw Object.assign(new Error('PRIVATE_SQL'),{code:'SQLITE_BUSY'});},
      createClient:()=>{throw new Error('provider must not start');}});
    const result=await runner.start({confirmed:true,taskId:'task-1',workspacePath:'/tmp/workspace',idempotencyKey:'rejected'});
    assert.equal(result.ok,false);assert.equal(result.error,'SQLITE_BUSY');assert.equal(result.reconciliationRequired,true);
    assert.equal(JSON.stringify(result).includes('PRIVATE_SQL'),false);
    assert.ok(f.store.get('omvra.taskContributionAttempts.v1').every(a=>a.state==='failed'&&a.failureReason==='runtime-binding-failed'));
    await runner.dispose();
  }
  for(const scope of [{kind:'task',taskId:null,executionAttemptId:'attempt',taskRevision:1},{kind:'task',taskId:'task',executionAttemptId:null,taskRevision:1}])
    await assert.rejects(f.repo.createSession({runtimeProfileId:'runtime',idempotencyKey:'invalid',scope}),{code:'INVALID_AGENT_WORK_IDENTIFIER'});
});

test('SQLite date projection shares Timeline semantics without rewriting task metadata',async t=>{
  const f=await fixture(t),task={id:'task-1',status:'open',__mcpRevision:7,archived:false};
  const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>[task],attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
  const b=(await service.createBinding(f.store,{runtimeProfileId:'runtime',scope:{kind:'task',taskId:'task-1',executionAttemptId:'attempt',taskRevision:7},idempotencyKey:'date-test'})).binding;
  const cases=[ [{},true], [{startDate:'2026-09-25'},false], [{endDate:'2026-09-25'},true], [{startDate:'invalid',endDate:'invalid'},true], [{startDate:'2026-02-30',endDate:'2026-03-02'},true], [{startDate:'2026-09-26',endDate:'2026-09-25'},true], [{startDate:'2026-09-25',endDate:'2026-09-25'},false], [{startDate:'2026-09-25',endDate:'2026-09-26'},false] ];
  for(const [dates,expected] of cases) {
    delete task.startDate;delete task.endDate;Object.assign(task,dates);
    const before=structuredClone(task);
    assert.equal((await service.list(f.store,{bindingId:b.id})).bindings[0].unscheduled,expected,JSON.stringify(dates));
    assert.deepEqual(task,before);
  }
});

test('storage outage preserves typed input and cancel transport, blocks launches and retries terminal commit without replay', async t => {
  const f=await fixture(t);
  const task={id:'task-1',status:'in-progress',__mcpRevision:4};
  const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>[task],attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
  let binding=(await service.createBinding(f.store,{runtimeProfileId:'runtime-1',scope:{kind:'task',taskId:task.id,executionAttemptId:'attempt-1',taskRevision:4},idempotencyKey:'controls'})).binding;
  binding=(await service.updateBinding(f.store,{bindingId:binding.id,expectedRevision:binding.revision,state:'interrupted',opaqueSessionRef:'provider-ref'})).binding;
  let outage=false,notify,closed=0,cancelled=0;
  const responses=[],emitted=[];
  const check=()=>{if(outage)throw Object.assign(new Error('PRIVATE_DISK_ERROR'),{code:'SQLITE_READONLY'});};
  const runner=createAgentRuntimeSessionRunner({store:f.store,resolveProfile:()=>({ok:true,profile:{id:'runtime-1'}}),
    listSessions:(...args)=>{check();return service.list(...args);},updateBinding:(...args)=>{check();return service.updateBinding(...args);},appendEvent:(...args)=>{check();return service.appendEvent(...args);},
    emitRuntimeEvent:e=>emitted.push(e),
    createClient:()=>({initialize:async()=>({capabilities:{resume:true,cancel:true}}),resumeSession:async()=>({sessionId:'provider-ref'}),prompt:async()=>{},onNotification:cb=>{notify=cb;},respond:async id=>responses.push(id),cancel:async()=>{cancelled++;return {acknowledged:true};},close:()=>closed++})});
  t.after(()=>runner.dispose());
  assert.equal((await runner.resume(binding.id,{workspacePath:'/tmp'})).ok,true);
  await notify({method:'turn/started'});
  outage=true;
  assert.equal((await notify({method:'mcpServer/elicitation/request',id:1,params:{requestedSchema:{}}})).error,'SQLITE_READONLY');
  assert.equal(runner.listRequests(binding.id).length,1);
  assert.equal(closed,0);
  assert.equal((await runner.start({confirmed:true})).error,'AGENT_WORK_STORAGE_FAILED');
  assert.equal((await runner.startGoalNode({})).error,'AGENT_WORK_STORAGE_FAILED');
  assert.equal((await runner.respond(binding.id,'1',{})).error,'ACP_REQUEST_NOT_FOUND','typed request IDs must not alias');
  const answerPending=runner.respond(binding.id,1,{action:'decline'});
  assert.equal((await runner.respond(binding.id,1,{action:'decline'})).error,'ACP_REQUEST_NOT_FOUND','concurrent responses are not sent twice');
  const answered=await answerPending;
  assert.equal(answered.ok,true);assert.equal(answered.reconciliationRequired,true);
  assert.equal((await runner.respond(binding.id,1,{})).error,'ACP_REQUEST_NOT_FOUND');
  const cancel=await runner.invoke(binding.id,'cancel');assert.equal(cancel.ok,true);assert.equal(cancel.storageFailure,true);
  assert.equal(cancelled,1);assert.deepEqual(responses,[1]);assert.equal(closed,0);
  assert.equal(emitted.some(e=>e.event?.nativeEventType==='turn/completed'),false);
  outage=false;await runner.reconcile();await runner.flush();
  assert.equal((await f.repo.snapshot({bindingId:binding.id})).turn.state,'interrupted');
  assert.deepEqual(responses,[1],'reconciliation never replays input');
  assert.equal(task.__mcpRevision,4);assert.equal(task.status,'in-progress');
  assert.equal(JSON.stringify(emitted).includes('PRIVATE_DISK_ERROR'),false);
});

test('failed completion stays unresolved until the safe terminal commit succeeds',async t=>{
  const f=await fixture(t),emitted=[];let notify,rejectTerminal=true;
  const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>[{id:'task-1'}],attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
  let b=(await service.createBinding(f.store,{runtimeProfileId:'runtime-1',scope:{kind:'task',taskId:'task-1',executionAttemptId:'attempt-1',taskRevision:0},idempotencyKey:'terminal-retry'})).binding;
  await service.updateBinding(f.store,{bindingId:b.id,expectedRevision:b.revision,state:'interrupted',opaqueSessionRef:'ref'});
  const runner=createAgentRuntimeSessionRunner({store:f.store,resolveProfile:()=>({ok:true,profile:{id:'runtime-1'}}),listSessions:service.list,appendEvent:service.appendEvent,
    updateBinding:(store,input)=>{if(rejectTerminal && input.turn?.state==='completed')throw Object.assign(new Error('full'),{code:'SQLITE_FULL'});return service.updateBinding(store,input);},emitRuntimeEvent:e=>emitted.push(e),
    createClient:()=>({initialize:async()=>({capabilities:{resume:true}}),resumeSession:async()=>({sessionId:'ref'}),prompt:async()=>{},onNotification:cb=>{notify=cb;},close:()=>{}})});
  t.after(()=>runner.dispose());
  await runner.resume(b.id,{workspacePath:'/tmp'});await notify({method:'turn/started'});
  await notify({method:'turn/completed',params:{status:'completed'}});
  assert.equal(emitted.some(e=>e.binding?.turn?.state==='completed'),false);
  assert.equal((await f.repo.snapshot({bindingId:b.id})).turn.state,'active');
  assert.equal((await notify({method:'turn/started'})).ignored,true,'late events cannot unseal a failed terminal commit');
  assert.equal((await runner.continueTask(b.id)).error,'AGENT_WORK_STORAGE_FAILED');
  rejectTerminal=false;await runner.reconcile();await runner.flush();
  assert.equal((await f.repo.snapshot({bindingId:b.id})).turn.state,'completed');
  assert.equal(emitted.some(e=>e.binding?.turn?.state==='completed'),true);
});

test('pruning under runtime ingress preserves ordered completion and responsive control transport',async t=>{
 const {performance}=require('node:perf_hooks');
 const {createRuntimeNotificationScheduler}=require('./agent-runtime-notifications.cjs');
 const f=await fixture(t);let notify,cancelReached=false;const deliveries=[],latencies=[];
 const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>[{id:'task-1'}],attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
 const scheduler=createRuntimeNotificationScheduler({send:n=>deliveries.push(n)});t.after(()=>scheduler.dispose());
 let b=(await service.createBinding(f.store,{runtimeProfileId:'runtime-1',scope:{kind:'task',taskId:'task-1',executionAttemptId:'attempt-1',taskRevision:0},idempotencyKey:'maintenance-stream'})).binding;
 await service.updateBinding(f.store,{bindingId:b.id,expectedRevision:b.revision,state:'interrupted',opaqueSessionRef:'ref'});
 const runner=createAgentRuntimeSessionRunner({store:f.store,resolveProfile:()=>({ok:true,profile:{id:'runtime-1'}}),listSessions:service.list,appendEvent:service.appendEvent,updateBinding:service.updateBinding,emitRuntimeEvent:e=>scheduler.accept(e),
 createClient:()=>({initialize:async()=>({capabilities:{resume:true,cancel:true}}),resumeSession:async()=>({sessionId:'ref'}),prompt:async()=>{},onNotification:cb=>{notify=cb;},cancel:async()=>{cancelReached=true;return {acknowledged:true};},close:()=>{}})});t.after(()=>runner.dispose());
 await runner.resume(b.id,{workspacePath:'/tmp'});await notify({method:'turn/started'});
 for(let i=0;i<250;i++)await notify({method:'item/toolCall/started',params:{}});
 const db=new DatabaseSync(path.join(f.directory,'workspace','agent-work-v1.sqlite'));db.prepare('UPDATE agent_events SET created_at=?').run(Date.now()-40*86400000);db.close();
 const preview=await service.maintenance.preview({action:'prune'});await service.maintenance.execute(preview.id);
 for(let i=0;i<100;i++){const start=performance.now();await notify({method:'item/toolCall/started',params:{}});latencies.push(performance.now()-start);}
 const cancellation=runner.invoke(b.id,'cancel');await new Promise(resolve=>setImmediate(resolve));assert.equal(cancelReached,true,'cancel reaches transport before persistence resolves');await cancellation;
 await notify({method:'turn/completed',params:{}});await runner.flush();
 assert.equal((await f.repo.snapshot({bindingId:b.id})).turn.state,'interrupted');assert.equal(deliveries.some(n=>n.category==='completed'),false);
 await service.maintenance.close();
 assert.ok(scheduler.diagnostics().pending<=2);
 latencies.sort((a,b)=>a-b);t.diagnostic(JSON.stringify({fixture:'100 sequential tool observations during manual prune',p95Ms:latencies[94],maxMs:latencies.at(-1),pendingToasts:scheduler.diagnostics().pending}));
});

test('native ACP progress traverses the real runner and SQLite into visible bounded delivery without persisting text',async t=>{
  const {EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
  const {createNativeRuntimeClient}=require('./agent-runtime-protocol-client.cjs');
  const {createAgentRuntimeDelivery}=require('./agent-runtime-delivery.cjs');
  const f=await fixture(t),task={id:'task-1',status:'in-progress',__mcpRevision:4};
  const service=createAgentWorkSessionService({repository:f.repo,store:f.store,readTasks:()=>[task],attachBindingToAttempt:()=>({ok:true}),appendTaskContext:()=>({ok:true})});
  let b=(await service.createBinding(f.store,{runtimeProfileId:'runtime-1',scope:{kind:'task',taskId:task.id,executionAttemptId:'attempt-1',taskRevision:4},idempotencyKey:'native-progress'})).binding;
  b=(await service.updateBinding(f.store,{bindingId:b.id,expectedRevision:b.revision,state:'interrupted',opaqueSessionRef:'native-session'})).binding;
  const delivery=createAgentRuntimeDelivery({loadBinding:async()=> (await service.list(f.store,{bindingId:b.id})).bindings[0]});
  const received=[],sub=await delivery.subscribe({ownerId:1,bindingId:b.id,visible:true,requestId:1,send:e=>received.push(e)});
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{child.killed=true;};
  let promptId;
  const reply=(id,result)=>child.stdout.write(JSON.stringify({jsonrpc:'2.0',id,result})+'\n');
  child.stdin={write:line=>{const m=JSON.parse(line);if(m.method==='initialize')queueMicrotask(()=>reply(m.id,{protocolVersion:1,agentCapabilities:{loadSession:true}}));else if(m.method==='session/load')queueMicrotask(()=>reply(m.id,{}));else if(m.method==='session/prompt')promptId=m.id;return true;}};
  const runner=createAgentRuntimeSessionRunner({store:f.store,resolveProfile:()=>({ok:true,profile:{id:'runtime-1',integrationMode:'acp-local-stdio',executablePath:'/usr/bin/fixture'}}),listSessions:service.list,updateBinding:service.updateBinding,appendEvent:service.appendEvent,
    emitRuntimeEvent:e=>delivery.accept(e),createClient:(profile,options)=>createNativeRuntimeClient(profile,{...options,spawnProcess:()=>child})});
  t.after(async()=>{await runner.dispose();delivery.dispose();});
  const pending=runner.resume(b.id,{workspacePath:'/tmp'});
  for(let i=0;i<100 && promptId===undefined;i++)await new Promise(r=>setTimeout(r,5));assert.notEqual(promptId,undefined);
  const update=(update,sessionId='native-session')=>child.stdout.write(JSON.stringify({jsonrpc:'2.0',method:'session/update',params:{sessionId,update}})+'\n');
  update({sessionUpdate:'agent_message_chunk',content:{type:'text',text:'Inspecting '}});
  update({sessionUpdate:'agent_message_chunk',content:{type:'text',text:'source files.'}});
  update({sessionUpdate:'tool_call',toolCallId:'tool-1',kind:'read',status:'in_progress',rawInput:{secret:'PRIVATE_TOOL_BODY'}});
  update({sessionUpdate:'tool_call_update',toolCallId:'tool-1',status:'completed',rawOutput:'PRIVATE_TOOL_BODY'});
  update({sessionUpdate:'plan',entries:[{content:'PRIVATE_PLAN_BODY',priority:'high',status:'in_progress'}]});
  update({sessionUpdate:'agent_thought_chunk',content:{type:'text',text:'PRIVATE_THOUGHT'}});
  update({sessionUpdate:'user_message_chunk',content:{type:'text',text:'PRIVATE_USER_ECHO'}});
  update({sessionUpdate:'agent_message_chunk',content:{type:'text',text:'WRONG_SESSION'}},'another-session');
  await runner.flush();await new Promise(r=>setTimeout(r,120));
  assert.ok(received.some(e=>e.kind==='output' && e.text==='Inspecting source files.'),'visible text arrives before prompt completion');
  const snapshot=delivery.snapshot({ownerId:1,subscriptionId:sub.subscriptionId,requestId:2}).snapshot;
  assert.equal(snapshot.output.text,'Inspecting source files.');assert.equal(snapshot.activity.tools.count,1);
  assert.equal(snapshot.turnState,'active');assert.ok(snapshot.activity.entries.some(e=>e.label==='Plan updated'));
  const durable=await f.repo.snapshot({bindingId:b.id});
  assert.ok(durable.events.some(e=>e.kind==='message-observed'));assert.ok(durable.events.some(e=>e.kind==='tool-state'));
  assert.equal(JSON.stringify(durable).includes('Inspecting'),false);
  assert.equal(JSON.stringify([durable,received]).includes('PRIVATE_'),false);assert.equal(JSON.stringify(received).includes('WRONG_SESSION'),false);
  reply(promptId,{stopReason:'end_turn'});assert.equal((await pending).ok,true);await runner.flush();
  assert.equal((await f.repo.snapshot({bindingId:b.id})).turn.state,'completed');
  assert.ok(received.some(e=>e.kind==='snapshot' && e.barrier.state==='committed' && e.output.text==='Inspecting source files.'));
  assert.equal(task.status,'in-progress');assert.equal(task.__mcpRevision,4);
});
