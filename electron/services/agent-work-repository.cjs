const path = require('node:path');
const fs = require('node:fs/promises');
const { Worker } = require('node:worker_threads');
const { LIMITS, normalizeCommand, safeError, fail } = require('./agent-work-contract.cjs');

const owners = new Set();
const storageError = data => Object.assign(new Error(data.message), { code: data.code });
/** @returns {Promise<import('./agent-work-repository.cjs').AgentWorkRepository>} */
async function createAgentWorkRepository({ storePath, policy, maintenanceSuspended = false } = {}) {
  if (typeof storePath !== 'string' || !path.isAbsolute(storePath)) fail('INVALID_WORKSPACE_STORE_PATH');
  const directory = path.join(path.dirname(storePath), path.basename(storePath, path.extname(storePath)));
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  const databasePath = path.join(await fs.realpath(directory), 'agent-work-v1.sqlite');
  if (owners.has(databasePath)) fail('AGENT_WORK_ALREADY_OPEN');
  owners.add(databasePath);
  let worker;
  try { worker = new Worker(path.join(__dirname, 'agent-work-sqlite-worker.cjs'), { workerData: { databasePath } }); }
  catch(error) { owners.delete(databasePath); throw storageError(safeError(error)); }
  let ordinal = 0;
  let queue = [];
  let pendingBytes = 0;
  let active = null;
  let closed = false;
  let closing = false;
  let fatal = null;
  let timer;
  let pruneTimer;
  let closePromise;
  let automatic = policy?.automatic !== false;
  let lastAutoPrune = 0;
  let lastCheckpoint = 0;
  let commandsSincePrune = 0;
  const metrics = { peakQueue: 0, peakBytes: 0, coalescedCommands: 0, rejectedCommands: 0, lastError: null };
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
  const failAll = error => {
    if (fatal) return;
    fatal = storageError(safeError(error));
    metrics.lastError = { code: fatal.code, message: fatal.message };
    clearInterval(timer); clearTimeout(pruneTimer);
    rejectReady(fatal);
    for (const command of [...(active?.commands || []), ...queue]) command.reject(fatal);
    queue=[]; active=null; pendingBytes=0;
    void worker.terminate();
  };
  worker.on('error', failAll);
  worker.on('exit', code=>{
    owners.delete(databasePath);
    if(!closed) failAll(Object.assign(new Error('AGENT_WORK_WORKER_EXITED'),{code:'AGENT_WORK_WORKER_EXITED'}));
  });
  worker.on('message',message=>{
    if(message.ready) { resolveReady(); return; }
    if(message.startupError) { failAll(storageError(message.startupError)); return; }
    if(!active || message.id!==active.id) return;
    const batch=active;
    active=null;
    for(const [index,command] of batch.commands.entries()) {
      pendingBytes-=command.bytes;
      if(message.error) command.reject(storageError(message.error));
      else command.resolve(batch.method==='appendBatch' ? message.result[index] : message.result);
    }
    if(message.error) {
      metrics.lastError=message.error;
      if(['SQLITE_CORRUPT','SQLITE_FULL','SQLITE_READONLY','AGENT_WORK_COUNTER_OVERFLOW'].includes(message.error.code)) { failAll(storageError(message.error)); return; }
    }
    if(batch.method==='close') { closed=true; clearInterval(timer); clearTimeout(pruneTimer); return; }
    commandsSincePrune += batch.commands.filter(c=>['appendEvent','completeTurn'].includes(c.method)).length;
    pump();
    if(commandsSincePrune>=100 && !pruneTimer && !closing) schedulePrune();
  });
  function pump() {
    if(active || !queue.length || fatal || closed) return;
    // A critical command may bypass other sessions' history, never its own preceding writes.
    let index=queue.findIndex((c,i)=>c.critical && !queue.slice(0,i).some(earlier=>earlier.key===c.key));
    if(index<0) index=0;
    const first=queue.splice(index,1)[0];
    const commands=[first];
    if(first.method==='appendEvent') {
      while(commands.length<LIMITS.batch && queue[0]?.method==='appendEvent' && queue[0].key===first.key) commands.push(queue.shift());
      metrics.coalescedCommands+=commands.length-1;
    }
    active={id:++ordinal,commands,method:first.method==='appendEvent'?'appendBatch':first.method};
    worker.postMessage({id:active.id,method:active.method,input:active.method==='appendBatch'?commands.map(c=>c.input):first.input});
  }
  function request(method,input={}) {
    try {
      if(fatal) throw fatal;
      if(closed || (closing && method!=='close')) fail('AGENT_WORK_CLOSED');
      const normalized=normalizeCommand(method,input);
      const bytes=Buffer.byteLength(JSON.stringify(normalized));
      const critical=['createSession','updateSession','completeTurn','close'].includes(method) || (method==='appendEvent' && ['permission-request','input-request','cancellation-state','session-closed'].includes(normalized.type));
      const count=queue.length+(active?.commands.length || 0);
      if(count >= (critical ? LIMITS.queue : LIMITS.queue-LIMITS.reserved) || pendingBytes+bytes>LIMITS.bytes-(critical?0:131072)) {
        metrics.rejectedCommands++;
        fail('AGENT_WORK_QUEUE_FULL');
      }
      pendingBytes+=bytes;
      const result=new Promise((resolve,reject)=>queue.push({method,input:normalized,bytes,critical,key:normalized.bindingId || normalized.scope?.taskId || method,resolve,reject}));
      metrics.peakQueue=Math.max(metrics.peakQueue,count+1);
      metrics.peakBytes=Math.max(metrics.peakBytes,pendingBytes);
      pump();
      return result;
    } catch(error) { return Promise.reject(error); }
  }
  function schedulePrune() {
    if(closing || fatal || pruneTimer || maintenanceSuspended || !automatic) return;
    pruneTimer=setTimeout(async()=>{
      pruneTimer=null;
      if(closing || fatal || maintenanceSuspended || !automatic) return;
      // Foreground commands have precedence at each 50 ms maintenance boundary.
      if(active || queue.length) { schedulePrune(); return; }
      try {
        const result=await request('prune');
        commandsSincePrune=0; lastAutoPrune=Date.now();
        if(result.more) schedulePrune();
      } catch(error) { metrics.lastError=safeError(error); }
    },50);
    pruneTimer.unref();
  }
  try { await ready; }
  catch(error) { await worker.terminate(); owners.delete(databasePath); throw error; }
  const repository = {
    preview: input=>request('preview',input),
    migrationSession: input=>request('migrationSession',input),
    migrationEvent: input=>request('migrationEvent',input),
    migrationVerify: ()=>request('migrationVerify'),
    migrationFinalize: input=>request('migrationFinalize',input),
    resumeMaintenance: ()=>{ maintenanceSuspended=false; schedulePrune(); },
    createSession: input=>request('createSession',input),
    updateSession: input=>request('updateSession',input),
    appendEvent: input=>request('appendEvent',input),
    completeTurn: input=>request('completeTurn',input),
    governance: input=>request('governance',input),
    snapshot: input=>request('snapshot',input),
    listSessions: async input=>{const result=await request('listSessions',input);const limit=input?.limit ?? 50;return {sessions:result.sessions.slice(0,limit),hasMore:result.sessions.length>limit};},
    saveDelivery: input=>request('saveDelivery',input),
    ackNotification: input=>request('ackNotification',input),
    setPolicy: async input=>{const result=await request('setPolicy',input);automatic=result.policy.automatic;schedulePrune();return result;},
    metrics: async()=>({...await request('metrics'),queue:{...metrics,depth:queue.length+(active?.commands.length || 0),bytes:pendingBytes}}),
    // One <=200-row batch per call; UI orchestration may yield/cancel between calls.
    prune: ()=>request('prune'),
    checkpoint: ()=>request('checkpoint'),
    compact: ()=>request('compact'),
    close: ()=>{
      if(closePromise) return closePromise;
      closing=true; clearInterval(timer); clearTimeout(pruneTimer);
      closePromise=(async()=>{
        if(!fatal) {
          // Drain admitted writes before closing; close must not leapfrog another session.
          while(active || queue.length) await new Promise(resolve=>setTimeout(resolve,5));
          if(!fatal) await request('close');
        }
        await worker.terminate(); owners.delete(databasePath); closed=true;
        if(fatal) throw fatal;
      })();
      return closePromise;
    },
  };
  if(policy) { try { await repository.setPolicy(policy); } catch(error) { await repository.close(); throw error; } }
  timer=setInterval(async()=>{
    if(closing || fatal || active || queue.length || maintenanceSuspended || !automatic) return;
    try {
      const m=await request('metrics');
      // Caps and pressure protection stay enabled when optional maintenance is disabled.
      if(m.counts.events>m.policy.events || m.counts.notifications>m.policy.notifications || (automatic && Date.now()-lastAutoPrune>=15*60000)) schedulePrune();
      if(automatic && (m.walBytes>=16*1048576 || (m.walBytes>0 && Date.now()-lastCheckpoint>=60000))) { await request('checkpoint');lastCheckpoint=Date.now(); }
      if(automatic) await request('compact');
    } catch(error) { metrics.lastError=safeError(error); }
  },1000);
  timer.unref();
  schedulePrune();
  return repository;
}
module.exports={createAgentWorkRepository};
