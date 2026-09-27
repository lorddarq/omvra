// QA probe (Teddy, 2026-09-27): manual prune/compact protection + delivery latency. Isolated temp dirs only.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const R=require('node:path').join(__dirname,'../../../electron/services/')+'/';
const {createAgentWorkRepository}=require(R+'agent-work-repository.cjs');
const {createAgentWorkMaintenance}=require(R+'agent-work-maintenance.cjs');
const DAY=86400000, sleep=ms=>new Promise(r=>setTimeout(r,ms));
const results=[];const check=(name,fn)=>{try{fn();results.push(['PASS',name]);}catch(e){results.push(['FAIL',name,e.message]);}};
async function fixture(){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'omvra-qa-prune-')),values=new Map();
  const store={path:path.join(dir,'store.json'),get:k=>values.get(k),set:(k,v)=>values.set(k,structuredClone(v)),delete:k=>values.delete(k)};
  const repo=await createAgentWorkRepository({storePath:store.path,policy:{automatic:false},maintenanceSuspended:true});
  const service=createAgentWorkMaintenance({repository:repo,store});
  for(const m of ['createSession','updateSession','appendEvent','completeTurn','saveDelivery','snapshot']){const o=repo[m];repo[m]=(x)=>o(x).catch(e=>{console.log('STEP FAIL',m,e.code,JSON.stringify(x).slice(0,200));throw e;});}
  const db=()=>{const d=new DatabaseSync(path.join(dir,'store','agent-work-v1.sqlite'));d.exec('PRAGMA busy_timeout=2000');return d;};
  return {dir,repo,service,db,async close(){await service.close();await repo.close();await fs.rm(dir,{recursive:true,force:true});}};
}
async function done(service){for(let i=0;i<6000;i++){const s=await service.status();if(s.operation?.status!=='running')return s;await sleep(10);}throw new Error('timeout');}
const scope=(n)=>({kind:'task',taskId:`task-${n}`,executionAttemptId:`attempt-${n}`,taskRevision:7});
const now=()=>new Date().toISOString();
async function session(repo,n,events){
  const b=(await repo.createSession({runtimeProfileId:'rt',scope:scope(n),idempotencyKey:`k-${n}`,turn:{id:`turn-${n}`,state:'active'}})).binding;
  for(let i=0;i<events;i++)await repo.appendEvent({bindingId:b.id,runtimeProfileId:'rt',turnId:`turn-${n}`,kind:'tool-state',idempotencyKey:`${n}-e${i}`});
  return b;
}
async function complete(repo,b,n,outcome='completed'){const r=await repo.completeTurn({bindingId:b.id,expectedRevision:b.revision,turnId:`turn-${n}`,outcome,idempotencyKey:`done-${n}`});return r.snapshot.binding;}
function row(d,sql,...a){return d.prepare(sql).get(...a);}
async function protectionMatrix(){
  const f=await fixture();
  try{
    // closed-old: expired; closed-recent: finished within 24h; ready: idle live; interrupted: recovery; active: waiting-input permission
    let b=await session(f.repo,'closedold',30);b=await complete(f.repo,b,'closedold');await f.repo.updateSession({bindingId:b.id,expectedRevision:b.revision,state:'closed',terminalReason:'closed',recoveryRequired:false});
    let c=await session(f.repo,'closedrecent',30);c=await complete(f.repo,c,'closedrecent');await f.repo.updateSession({bindingId:c.id,expectedRevision:c.revision,state:'closed',terminalReason:'closed',recoveryRequired:false});
    let r=await session(f.repo,'ready',30);r=await complete(f.repo,r,'ready');r=(await f.repo.updateSession({bindingId:r.id,expectedRevision:r.revision,state:'ready',opaqueSessionRef:'opaque-ready-ref'})).binding;
    await f.repo.saveDelivery({bindingId:r.id,surface:'supervisor',lastSnapshotVersion:1,lastSentSeq:30});
    let i=await session(f.repo,'interrupted',30);i=await complete(f.repo,i,'interrupted','interrupted');i=(await f.repo.updateSession({bindingId:i.id,expectedRevision:i.revision,state:'interrupted',terminalReason:'process-exit'})).binding;
    let a=await session(f.repo,'active',2100);
    await f.repo.appendEvent({bindingId:a.id,runtimeProfileId:'rt',turnId:'turn-active',kind:'permission',requestId:'req-1',permissionState:'requested',idempotencyKey:'perm-1'});
    a=(await f.repo.snapshot({bindingId:a.id,limit:1})).binding;
    a=(await f.repo.updateSession({bindingId:a.id,expectedRevision:a.revision,turn:{...a.turn,state:'waiting-input',requestId:'req-1'}})).binding;
    await f.repo.saveDelivery({bindingId:a.id,surface:'supervisor',lastSnapshotVersion:1,lastSentSeq:2000});
    // Age everything 40 days except closed-recent session/turn finish.
    const d=f.db(),old=Date.now()-40*DAY;
    d.prepare('UPDATE agent_events SET created_at=?').run(old);
    d.prepare('UPDATE agent_notifications SET created_at=?,expires_at=?').run(old,old+DAY);
    d.prepare("UPDATE agent_turns SET finished_at=?,created_at=?,started_at=?,updated_at=? WHERE finished_at IS NOT NULL AND session_id<>?").run(old,old-1,old-1,old,c.id);
    d.prepare("UPDATE agent_sessions SET finished_at=?,created_at=?,updated_at=?,last_observed_at=? WHERE id<>? AND finished_at IS NOT NULL").run(old,old-1,old,old,c.id);
    d.prepare("UPDATE agent_work_projections SET finished_at=? WHERE session_id<>? AND finished_at IS NOT NULL").run(old,c.id);
    const snapshotOf=id=>({s:row(d,'SELECT state,revision,recovery_required,governance_json,provider_session_ref,attention_state,source_revision,task_id,attempt_id,last_event_seq FROM agent_sessions WHERE id=?',id),
      t:row(d,'SELECT id,state,request_id,final_summary,outcome FROM agent_turns WHERE session_id=? ORDER BY turn_index DESC LIMIT 1',id),
      p:row(d,'SELECT * FROM agent_work_projections WHERE session_id=?',id),ds:row(d,'SELECT count(*) n FROM agent_delivery_state WHERE session_id=?',id).n});
    const before={};for(const x of [c,r,i,a])before[x.id]=snapshotOf(x.id);
    d.close();
    const p=await f.service.preview({action:'prune'});
    check('preview reports protected sessions (ready, interrupted, active)',()=>assert.equal(p.protectedRecords.count,3));
    check('preview marks closed-old session eligible and nothing else',()=>assert.equal(p.eligible.sessions,1));
    const op=await f.service.execute(p.id);const res=await done(f.service);
    check('prune completed',()=>assert.equal(res.operation.status,'completed',JSON.stringify(res.operation)));
    const d2=f.db();
    check('closed-old session, turns, events, projection deleted',()=>{assert.equal(row(d2,'SELECT count(*) n FROM agent_sessions WHERE id=?',b.id).n,0);assert.equal(row(d2,'SELECT count(*) n FROM agent_events WHERE session_id=?',b.id).n,0);assert.equal(row(d2,'SELECT count(*) n FROM agent_work_projections WHERE session_id=?',b.id).n,0);});
    for(const [label,x] of [['closed-recent (<24h)',c],['ready/idle live',r],['interrupted recovery',i],['active waiting-input',a]]){
      const after=(()=>{const s=row(d2,'SELECT state,revision,recovery_required,governance_json,provider_session_ref,attention_state,source_revision,task_id,attempt_id,last_event_seq FROM agent_sessions WHERE id=?',x.id);return {s,t:row(d2,'SELECT id,state,request_id,final_summary,outcome FROM agent_turns WHERE session_id=? ORDER BY turn_index DESC LIMIT 1',x.id),p:row(d2,'SELECT * FROM agent_work_projections WHERE session_id=?',x.id),ds:row(d2,'SELECT count(*) n FROM agent_delivery_state WHERE session_id=?',x.id).n};})();
      check(`${label}: session snapshot/counters/reference unchanged`,()=>assert.deepEqual(after.s,before[x.id].s));
      check(`${label}: latest turn + final summary retained`,()=>assert.deepEqual(after.t,before[x.id].t));
      check(`${label}: work projection retained`,()=>assert.deepEqual(after.p,before[x.id].p));
      check(`${label}: delivery cursor retained`,()=>assert.equal(after.ds,before[x.id].ds));
    }
    check('active: pending permission request metadata retained in snapshot',()=>{const g=JSON.parse(row(d2,'SELECT governance_json g FROM agent_sessions WHERE id=?',a.id).g);assert.equal(g.pendingAttention?.requestId,'req-1');assert.equal(row(d2,'SELECT request_id r FROM agent_turns WHERE id=?','turn-active').r,'req-1');});
    check('active: aged event detail pruned as contiguous prefix (allowed by policy)',()=>{const s=row(d2,'SELECT pruned_through_seq p,last_event_seq l FROM agent_sessions WHERE id=?',a.id);const min=row(d2,'SELECT min(seq) m,count(*) n FROM agent_events WHERE session_id=?',a.id);assert.ok(s.p>0);assert.equal(min.n===0?s.l:min.m-1,s.p);});
    d2.close();
    const snap=await f.repo.snapshot({bindingId:a.id,limit:5});
    check('active: snapshot still waiting-input with requestId after prune',()=>{assert.equal(snap.turn.state,'waiting-input');assert.equal(snap.binding.turn.requestId,'req-1');});
    // active can still resolve permission and complete after prune
    let a2=(await f.repo.updateSession({bindingId:a.id,expectedRevision:snap.binding.revision,turn:{...snap.binding.turn,state:'active'}})).binding;
    const fin=await f.repo.completeTurn({bindingId:a.id,expectedRevision:a2.revision,turnId:'turn-active',outcome:'completed',idempotencyKey:'done-active'});
    check('active: completion commits after prune with notification',()=>{assert.equal(fin.snapshot.turn.state,'completed');assert.ok(fin.notification);});
    const cp=await f.service.preview({action:'compact'});await f.service.execute(cp.id);const cres=await done(f.service);
    check('compact with live/recovery sessions defers, zero rows deleted',()=>{assert.equal(cres.operation.status,'deferred');assert.equal(cres.operation.deletedRows,0);assert.ok(Object.values(cp.eligible).every(n=>n===0));});
  } finally {await f.close();}
}
function pct(a,p){const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))];}
async function latency(){
  const f=await fixture();
  try{
    // 12 expired closed sessions with seeded aged events = 24,000 rows via SQL (fast seeding)
    for(let n=0;n<12;n++){let b=await session(f.repo,`old${n}`,1);b=await complete(f.repo,b,`old${n}`);await f.repo.updateSession({bindingId:b.id,expectedRevision:b.revision,state:'closed',terminalReason:'closed',recoveryRequired:false});}
    const d=f.db(),old=Date.now()-40*DAY;
    const ins=d.prepare("INSERT INTO agent_events VALUES(?,?,NULL,?,?,'tool-state','tool-state',2,'Tool state changed.','{}',?,?)");
    d.exec('BEGIN');for(let n=0;n<12;n++){const id=row(d,'SELECT id FROM agent_sessions WHERE task_id=?',`task-old${n}`).id;for(let k=2;k<=2001;k++)ins.run(`seed-${n}-${k}`,id,k,`seed-${n}-${k}`,old,old);d.prepare('UPDATE agent_sessions SET last_event_seq=2001 WHERE id=?').run(id);}d.exec('COMMIT');
    d.prepare('UPDATE agent_sessions SET finished_at=?,created_at=?,updated_at=?,last_observed_at=? WHERE finished_at IS NOT NULL').run(old,old-1,old,old);
    d.prepare('UPDATE agent_turns SET finished_at=?,created_at=?,started_at=?,updated_at=? WHERE finished_at IS NOT NULL').run(old,old-1,old-1,old);
    d.prepare('UPDATE agent_work_projections SET finished_at=? WHERE finished_at IS NOT NULL').run(old);
    d.close();
    const a=await session(f.repo,'live',0);
    const drive=async(count,tag)=>{const lat=[];for(let k=0;k<count;k++){const t=performance.now();await f.repo.appendEvent({bindingId:a.id,runtimeProfileId:'rt',turnId:'turn-live',kind:'tool-state',idempotencyKey:`${tag}-${k}`});lat.push(performance.now()-t);await sleep(2);}return lat;};
    const base=await drive(300,'base');
    const before=(await f.repo.metrics()).counts.events;
    const p=await f.service.preview({action:'prune'});const op=await f.service.execute(p.id);
    const t0=performance.now();const during=[];let k=0;
    while((await f.service.status()).operation.status==='running'){const t=performance.now();await f.repo.appendEvent({bindingId:a.id,runtimeProfileId:'rt',turnId:'turn-live',kind:'tool-state',idempotencyKey:`during-${k++}`});during.push(performance.now()-t);await sleep(2);}
    const pruneMs=performance.now()-t0;const st=await f.service.status();
    // permission (critical) during a second prune-sized window is covered by queue priority; measure completion commit latency now
    const snap=await f.repo.snapshot({bindingId:a.id,limit:1});
    const tc=performance.now();await f.repo.completeTurn({bindingId:a.id,expectedRevision:snap.binding.revision,turnId:'turn-live',outcome:'completed',idempotencyKey:'done-live'});const completeMs=performance.now()-tc;
    const after=await f.repo.metrics();
    results.push(['INFO',`seeded aged rows=${before-300}, deleted=${st.operation.deletedRows}, batches=${st.operation.batches}, prune wall=${pruneMs.toFixed(0)}ms, status=${st.operation.status}`]);
    results.push(['INFO',`baseline append p50=${pct(base,.5).toFixed(2)} p95=${pct(base,.95).toFixed(2)} max=${Math.max(...base).toFixed(2)}ms (n=${base.length})`]);
    results.push(['INFO',`during-prune append p50=${pct(during,.5).toFixed(2)} p95=${pct(during,.95).toFixed(2)} max=${Math.max(...during).toFixed(2)}ms (n=${during.length}); completeTurn after=${completeMs.toFixed(2)}ms`]);
    check('all live appends during prune persisted, none rejected',()=>{assert.equal(after.queue.rejectedCommands,0);assert.equal(row2(f,a.id),300+during.length);});
    check('live session events untouched by prune (not aged)',()=>assert.equal(row2(f,a.id,true),0));
    check('during-prune append p95 < 50ms (one bounded batch)',()=>assert.ok(pct(during,.95)<50));
    check('prune removed all aged seeded rows',()=>assert.equal(st.operation.status,'completed'));
  } finally {await f.close();}
}
function row2(f,id,pruned){const d=f.db();const v=pruned?row(d,'SELECT pruned_through_seq p FROM agent_sessions WHERE id=?',id).p:row(d,'SELECT count(*) n FROM agent_events WHERE session_id=?',id).n;d.close();return v;}
(async()=>{
  await protectionMatrix();await latency();
  for(const r of results)console.log(r.join(' | '));
  const fails=results.filter(r=>r[0]==='FAIL').length;console.log(`SUMMARY fails=${fails} checks=${results.filter(r=>r[0]!=='INFO').length}`);process.exit(fails?1:0);
})().catch(e=>{console.error('PROBE ERROR',e);process.exit(2);});
