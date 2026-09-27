// Main-process scheduling of safe, committed runtime facts. Attention remains in
// the binding/request projection even when a toast expires or is evicted.
const {createHash}=require('node:crypto');
const LIMITS = {workspace:32,task:8,seen:512,quiet:2000,maxWait:5000,slot:4000,ordinaryRate:5000,ordinaryTtl:30000,terminalTtl:300000};
const priorities = {permission:0,input:0,failure:1,blocked:1,cancelled:1,completed:1,activity:2};
const summaries = {permission:'Agent needs permission',input:'Agent needs input',failure:'Agent work needs attention',blocked:'Agent work is blocked',cancelled:'Agent run stopped',completed:'Agent run finished',activity:'Agent activity updated'};
function createRuntimeNotificationScheduler({send,isTaskVisible=()=>false,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}) {
  const queue=new Map(),seen=new Map(),versions=new Map();let timer=null,nextSlot=0,lastOrdinary=-Infinity,disposed=false;
  function expire() {
    const at=now();
    for(const [key,n] of queue)if(n.expiresAt<=at || n.category==='activity' && isTaskVisible(n.taskId))queue.delete(key);
    for(const [key,until] of seen)if(until<=at)seen.delete(key);
  }
  function schedule() {
    if(timer!==null)clearTimer(timer);timer=null;
    if(disposed || !queue.size)return;
    const at=now();
    const due=Math.min(...[...queue.values()].map(n=>Math.min(n.expiresAt,Math.max(n.dueAt,n.priority===0?at:nextSlot,n.category==='activity'?lastOrdinary+LIMITS.ordinaryRate:at))));
    timer=setTimer(flush,Math.max(0,due-at));
  }
  function flush() {
    timer=null;expire();const at=now();
    const candidates=[...queue.values()].filter(n=>n.dueAt<=at && (n.priority===0 || nextSlot<=at) && (n.category!=='activity' || lastOrdinary+LIMITS.ordinaryRate<=at)).sort((a,b)=>a.priority-b.priority || a.createdAt-b.createdAt);
    const n=candidates[0];
    if(n) {
      let delivered=false;
      try { delivered=send({...n,safeSummary:summaries[n.category]})!==false; } catch { /* A destroyed renderer must not crash the main process. */ }
      if(delivered) {
        queue.delete(n.key);nextSlot=at+LIMITS.slot;
        if(n.category==='activity')lastOrdinary=at;
      } else n.dueAt=at+1000;
    }
    schedule();
  }
  function accept(payload) {
    if(disposed)return;expire();
    const b=payload.binding,e=payload.event;
    if(b?.scope?.kind!=='task' || !b.scope.taskId)return;
    const version=b.snapshotVersion ?? b.revision ?? 0;
    if(version < (versions.get(b.id) ?? -1))return;
    versions.set(b.id,version);
    while(versions.size>100)versions.delete(versions.keys().next().value);
    const turn=b.turn?.id || 'session';
    for(const [key,n] of queue) if(n.bindingId===b.id && (n.turnId!==b.turn?.id || ['permission','input'].includes(n.category) && b.turn?.state!=='waiting-input')) queue.delete(key);
    let category,identity;
    if(b.turn?.state==='waiting-input') {if(payload.requestId===undefined)return;category='permission';identity=payload.requestId;}
    else if(payload.kind==='binding' && ['completed','failed','interrupted'].includes(b.turn?.state)) {category=({completed:'completed',failed:'failure',interrupted:'cancelled'})[b.turn.state];identity=turn;}
    else if(payload.kind==='event' && ['tool','tool-state','tool-call','tool-progress','file-change','plan','plan-update'].includes(e?.type)) {category='activity';identity=e.id;}
    else return;
    if(category==='activity' && isTaskVisible(b.scope.taskId))return;
    const at=now(),dedupe=`${b.id}:${turn}:${category}:${createHash('sha256').update(`${typeof identity}:${identity}`).digest('hex')}`;
    if(seen.has(dedupe))return;
    seen.set(dedupe,at+LIMITS.terminalTtl);
    while(seen.size>LIMITS.seen)seen.delete(seen.keys().next().value);
    const key=category==='activity'?`${b.id}:${turn}:activity`:dedupe;
    const prior=queue.get(key);
    const n={key,notificationId:dedupe,bindingId:b.id,taskId:b.scope.taskId,turnId:b.turn?.id,requiredVersion:b.snapshotVersion ?? b.revision ?? 0,category,priority:priorities[category],createdAt:prior?.createdAt ?? at,dueAt:category==='activity'?Math.min(at+LIMITS.quiet,(prior?.createdAt ?? at)+LIMITS.maxWait):at,expiresAt:prior?.expiresAt ?? at+(category==='activity'?LIMITS.ordinaryTtl:LIMITS.terminalTtl)};
    queue.set(key,n);
    for(const scope of [b.scope.taskId,null]) {
      const entries=()=>[...queue.values()].filter(x=>scope===null || x.taskId===scope);
      const cap=scope===null?LIMITS.workspace:LIMITS.task;
      while(entries().length>cap) {const victim=entries().sort((a,b)=>b.priority-a.priority || a.createdAt-b.createdAt)[0];queue.delete(victim.key);}
    }
    schedule();
  }
  return {accept,visibilityChanged:()=>{expire();schedule();},diagnostics:()=>({pending:queue.size,seen:seen.size,timers:Number(timer!==null)}),dispose:()=>{disposed=true;if(timer!==null)clearTimer(timer);timer=null;queue.clear();seen.clear();versions.clear();}};
}
module.exports={createRuntimeNotificationScheduler,LIMITS};
