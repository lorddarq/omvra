const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {createAgentWorkRepository}=require('./agent-work-repository.cjs');
const {createAgentWorkMaintenance,POLICY_KEY}=require('./agent-work-maintenance.cjs');
const {DEFAULT_POLICY}=require('./agent-work-contract.cjs');
async function fixture(t) {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omvra-policy-')),values=new Map();
 const store={path:path.join(dir,'store.json'),get:k=>values.get(k),set:(k,v)=>values.set(k,structuredClone(v)),delete:k=>values.delete(k)};
 const repo=await createAgentWorkRepository({storePath:store.path,policy:{automatic:false},maintenanceSuspended:true});
 const service=createAgentWorkMaintenance({repository:repo,store});
 t.after(async()=>{await service.close();await repo.close();await fs.rm(dir,{recursive:true,force:true});});
 return {dir,store,repo,service,db:()=>new DatabaseSync(path.join(dir,'store','agent-work-v1.sqlite'))};
}
async function done(service) {
 for(let i=0;i<200;i++){const s=await service.status();if(s.operation?.status!=='running')return s;await new Promise(r=>setTimeout(r,10));}throw new Error('operation timed out');
}
test('confirmed policy persists, stale/invalid previews fail, duplicate admission returns one operation',async t=>{
 const f=await fixture(t);
 await assert.rejects(f.service.preview({action:'policy',policy:{events:0}}));
 const stale=await f.service.preview({action:'prune'});
 const p=await f.service.preview({action:'policy',policy:{...DEFAULT_POLICY,automatic:false,eventDays:1}});
 const [a,b]=await Promise.all([f.service.execute(p.id),f.service.execute(p.id)]);assert.equal(a.id,b.id);
 assert.equal((await done(f.service)).operation.status,'completed');
 assert.equal(f.store.get(POLICY_KEY).eventDays,1);
 await assert.rejects(f.service.execute(stale.id),{code:'AGENT_WORK_PREVIEW_STALE'});
 const reopened=await createAgentWorkRepository({storePath:path.join(f.dir,'reopen.json'),policy:f.store.get(POLICY_KEY)});
 assert.equal((await reopened.metrics()).policy.eventDays,1);await reopened.close();
 const next=await f.service.preview({action:'compact'});await f.service.execute(next.id);await done(f.service);
 assert.equal((await f.service.execute(p.id)).id,a.id,'consumed previews cannot rerun');
});
test('preview is non-mutating, protects active/recovery state, and pruning cancels between bounded batches',async t=>{
 const f=await fixture(t);
 const b=(await f.repo.createSession({runtimeProfileId:'runtime',scope:{kind:'task',taskId:'task',executionAttemptId:'attempt',taskRevision:4},idempotencyKey:'binding',turn:{id:'turn',state:'active'}})).binding;
 for(let n=0;n<450;n++)await f.repo.appendEvent({bindingId:b.id,runtimeProfileId:'runtime',turnId:'turn',kind:'tool',idempotencyKey:`event-${n}`});
 const db=f.db();db.prepare('UPDATE agent_events SET created_at=?').run(Date.now()-40*86400000);db.close();
 f.repo.resumeMaintenance();await new Promise(r=>setTimeout(r,150));
 assert.equal((await f.repo.metrics()).counts.events,450,'automatic off leaves age expiry disabled');
 const p=await f.service.preview({action:'prune'});assert.equal(p.eligible.events,450);assert.equal(p.eligible.sessions,0);assert.equal(p.protectedRecords.count,1);
 assert.equal((await f.repo.metrics()).counts.events,450);
 const op=await f.service.execute(p.id);let heartbeats=0;const timer=setInterval(()=>heartbeats++,1);
 while((await f.repo.metrics()).counts.events===450)await new Promise(r=>setTimeout(r,2));
 f.service.cancel(op.id);const result=await done(f.service);clearInterval(timer);
 assert.equal(result.operation.status,'cancelled');assert.ok(result.operation.deletedRows<=400);assert.ok(heartbeats>5);
 const snap=await f.repo.snapshot({bindingId:b.id});assert.equal(snap.turn.state,'active');assert.equal(snap.session.source_revision,4);
 const compact=await f.service.preview({action:'compact'});assert.ok(Object.values(compact.eligible).every(n=>n===0));
 await f.service.execute(compact.id);assert.equal((await done(f.service)).operation.status,'deferred');
 assert.equal((await f.repo.snapshot({bindingId:b.id})).turn.state,'active');
});
test('IPC redacts errors, store writes cannot bypass confirmations, and shutdown cancels admitted work',async t=>{
 const f=await fixture(t),handlers=new Map();
 require('../ipc/agent-work.cjs').registerAgentWorkIpcHandlers({ipcMain:{handle:(k,v)=>handlers.set(k,v)},ready:Promise.resolve({maintenance:f.service})});
 assert.equal((await handlers.get('agent-work/preview')(null,{action:'sql',sql:'PRIVATE'})).ok,false);
 const invalid=await handlers.get('agent-work/execute')(null,'not-a-preview');assert.deepEqual(invalid,{ok:false,error:'AGENT_WORK_PREVIEW_STALE'});
 require('../ipc/store.cjs').registerStoreIpcHandlers({ipcMain:{handle:(k,v)=>handlers.set(k,v)},store:f.store,agentWorkManaged:true});
 for(const key of [POLICY_KEY,'omvra.agentWorkPolicy',POLICY_KEY+'.automatic'])assert.throws(()=>handlers.get('store/set')(null,key,false));
 const p=await f.service.preview({action:'prune'});await f.service.execute(p.id);await f.service.close();
 assert.equal((await f.service.status()).operation.status,'cancelled');
});
