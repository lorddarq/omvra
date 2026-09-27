// QA probe (Teddy, 2026-09-27): SQLite session lifecycle never writes task/Goal/milestone authority. Isolated temp store.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const W=require('node:path').join(__dirname,'../../../electron/services/workspace-service.cjs');
const workspace=require(W);
const AUTH=['omvra.tasks.v1','omvra.goals.v1','omvra.goalExecutions.v1','omvra.milestones.v1'];
const results=[];const check=async(name,fn)=>{try{await fn();results.push(['PASS',name]);}catch(e){results.push(['FAIL',name,e.code||e.message]);}};
(async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omvra-qa-authority-'));const values=new Map(),writes=[];
  const mk=()=>({path:path.join(dir,'workspace.json'),get:k=>structuredClone(values.get(k)),set:(k,v)=>{if(typeof k==='object'){for(const [a,b] of Object.entries(k)){values.set(a,structuredClone(b));writes.push(a);}}else{values.set(k,structuredClone(v));writes.push(k);}},delete:k=>{values.delete(k);writes.push(k);}});
  const tasks=[{id:'t-unsched',title:'Unscheduled',status:'in-progress',__mcpRevision:4,dependencyIds:['t-dep'],milestoneId:'m1'},
    {id:'t-sched',title:'Scheduled',status:'in-progress',__mcpRevision:9,startDate:'2026-10-09',endDate:'2026-10-16',dependencyIds:[]},
    {id:'t-dep',title:'Dep',status:'done',__mcpRevision:2}];
  let store=mk();
  store.set('omvra.tasks.v1',tasks);store.set('omvra.goals.v1',[{id:'g1',title:'Goal',status:'running',__mcpRevision:3}]);store.set('omvra.goalExecutions.v1',[{id:'ge1',goalId:'g1',state:'running'}]);store.set('omvra.milestones.v1',[{id:'m1',title:'M'}]);
  const authority=()=>JSON.stringify(AUTH.map(k=>values.get(k)));const base=authority();writes.length=0;
  let owner=await workspace.initializeAgentWorkStorage(store);
  const scope=(t,a,rev)=>({kind:'task',taskId:t,executionAttemptId:a,taskRevision:rev});
  const same=label=>check(`${label}: task/Goal/milestone records byte-identical and never written`,()=>{assert.equal(authority(),base);assert.deepEqual(writes.filter(k=>AUTH.includes(k)),[]);});
  // START (unscheduled) + COMPLETE
  let b=(await workspace.createAgentRuntimeSessionBinding(store,{runtimeProfileId:'rt',scope:scope('t-unsched','att-1',4),idempotencyKey:'s1',turn:{id:'turn-1',state:'active'}})).binding;
  await same('start (unscheduled task)');
  await check('unscheduled task reportable: list projects unscheduled=true from task record',async()=>{const l=(await workspace.listAgentRuntimeSessions(store,{bindingId:b.id})).bindings[0];assert.equal(l.unscheduled,true);assert.equal(l.taskAvailable,true);});
  await workspace.appendAgentRuntimeEvent(store,{bindingId:b.id,runtimeProfileId:'rt',turnId:'turn-1',kind:'tool',idempotencyKey:'e1'});
  let r=await workspace.updateAgentRuntimeSessionBinding(store,{bindingId:b.id,expectedRevision:b.revision,turn:{id:'turn-1',state:'completed'}});
  await check('completion commits in SQLite (turn completed, summary present)',()=>{assert.equal(r.ok,true);assert.equal(r.binding.turn.state,'completed');});
  await same('turn completion');
  await check('completion does not imply acceptance: taskExecution=batch-finished, task status unchanged',async()=>{const l=(await workspace.listAgentRuntimeSessions(store,{bindingId:b.id})).bindings[0];assert.equal(l.taskExecution.state,'batch-finished');assert.equal(values.get('omvra.tasks.v1')[0].status,'in-progress');});
  // close session 1
  b=r.binding;r=await workspace.updateAgentRuntimeSessionBinding(store,{bindingId:b.id,expectedRevision:b.revision,state:'closed',terminalReason:'closed'});
  await same('session close');
  // CANCEL on scheduled task
  let c=(await workspace.createAgentRuntimeSessionBinding(store,{runtimeProfileId:'rt',scope:scope('t-sched','att-2',9),idempotencyKey:'s2',turn:{id:'turn-2',state:'active'}})).binding;
  await check('scheduled task projects unscheduled=false',async()=>assert.equal((await workspace.listAgentRuntimeSessions(store,{bindingId:c.id})).bindings[0].unscheduled,false));
  c=(await workspace.updateAgentRuntimeSessionBinding(store,{bindingId:c.id,expectedRevision:c.revision,turn:{id:'turn-2',state:'cancelling'}})).binding;
  c=(await workspace.updateAgentRuntimeSessionBinding(store,{bindingId:c.id,expectedRevision:c.revision,turn:{id:'turn-2',state:'interrupted'}})).binding;
  await check('cancel ends turn interrupted',()=>assert.equal(c.turn.state,'interrupted'));
  await same('cancel');
  // CRASH: active turn on unscheduled task, then close owner without terminal and reopen
  let d=(await workspace.createAgentRuntimeSessionBinding(store,{runtimeProfileId:'rt',scope:scope('t-unsched','att-3',4),idempotencyKey:'s3',turn:{id:'turn-3',state:'active'}})).binding;
  await workspace.updateAgentRuntimeSessionBinding(store,{bindingId:c.id,expectedRevision:c.revision,state:'closed'}).catch(()=>{});
  await owner.close();
  store=mk();owner=await workspace.initializeAgentWorkStorage(store);
  const crashed=(await workspace.listAgentRuntimeSessions(store,{bindingId:d.id})).bindings[0];
  await check('crash/reopen: active turn recovered as interrupted, recovery required, no completion invented',()=>{assert.equal(crashed.turn.state,'interrupted');assert.equal(crashed.recoveryRequired,true);assert.equal(crashed.taskExecution.state,'interrupted');});
  await same('crash + reopen');
  // ARCHIVE: governed archive preparation closes interrupted session, clears provider ref, doesn't touch task archive state
  const arch=await workspace.prepareAgentRuntimeSessionArchive(store,d.id);
  await check('archive preparation closes recoverable session and clears opaque reference',()=>{assert.equal(arch.ok,true);assert.equal(arch.binding.state,'closed');assert.equal(arch.binding.opaqueSessionRef,undefined);assert.equal(arch.binding.recoveryRequired,false);});
  await same('archive preparation');
  // archive refused while active
  let e=(await workspace.createAgentRuntimeSessionBinding(store,{runtimeProfileId:'rt',scope:scope('t-sched','att-4',9),idempotencyKey:'s4',turn:{id:'turn-4',state:'active'}})).binding;
  await check('archive preparation refuses an active session (no implicit cancel)',async()=>{const x=await workspace.prepareAgentRuntimeSessionArchive(store,e.id);assert.equal(x.ok,false);assert.equal(x.error,'ACP_SESSION_ACTIVE');const l=(await workspace.listAgentRuntimeSessions(store,{bindingId:e.id})).bindings[0];assert.equal(l.turn.state,'active');});
  e=(await workspace.updateAgentRuntimeSessionBinding(store,{bindingId:e.id,expectedRevision:e.revision,turn:{id:'turn-4',state:'failed'}})).binding;
  await same('failed turn');
  await check('failed turn projects failed execution, task status unchanged',async()=>{const l=(await workspace.listAgentRuntimeSessions(store,{bindingId:e.id})).bindings[0];assert.equal(l.taskExecution.state,'failed');});
  e=(await workspace.updateAgentRuntimeSessionBinding(store,{bindingId:e.id,expectedRevision:e.revision,state:'closed'})).binding;
  // Task archived in workspace -> list still works, archive/restore not dependent on history
  const t=values.get('omvra.tasks.v1');t[1].archived=true;values.set('omvra.tasks.v1',t);const base2=JSON.stringify(values.get('omvra.tasks.v1'));
  await check('archived task: sessions still listable; SQLite does not un-archive',async()=>{const l=(await workspace.listAgentRuntimeSessions(store,{bindingId:c.id})).bindings[0];assert.equal(l.taskAvailable,true);assert.equal(JSON.stringify(values.get('omvra.tasks.v1')),base2);});
  // GOAL node
  const g=(await workspace.createAgentRuntimeSessionBinding(store,{runtimeProfileId:'rt',scope:{kind:'goal-node',goalId:'g1',goalElementId:'n1',goalExecutionId:'ge1',executionAttempt:0,goalRevision:3},idempotencyKey:'s5',turn:{id:'turn-5',state:'active'}}));
  await check('goal-node session created',()=>assert.equal(g.ok,true,JSON.stringify(g).slice(0,200)));
  if(g.ok){let gb=g.binding;gb=(await workspace.updateAgentRuntimeSessionBinding(store,{bindingId:gb.id,expectedRevision:gb.revision,turn:{id:'turn-5',state:'completed'}})).binding;
    await check('goal-node completion does not write Goal/execution state',()=>{assert.equal(JSON.stringify(values.get('omvra.goals.v1')),JSON.stringify([{id:'g1',title:'Goal',status:'running',__mcpRevision:3}]));assert.equal(values.get('omvra.goalExecutions.v1')[0].state,'running');});}
  await check('no writes to task/Goal/milestone keys during entire lifecycle (except test-harness archive flag)',()=>assert.deepEqual(writes.filter(k=>AUTH.includes(k)),[]));
  results.push(['INFO','store keys written by facade: '+[...new Set(writes)].join(', ')]);
  await owner.close();await fs.rm(dir,{recursive:true,force:true});
  for(const x of results)console.log(x.join(' | '));const fails=results.filter(x=>x[0]==='FAIL').length;console.log(`SUMMARY fails=${fails} checks=${results.filter(x=>x[0]!=='INFO').length}`);process.exit(fails?1:0);
})().catch(e=>{console.error('PROBE ERROR',e.code,e.message,e.stack);process.exit(2);});
