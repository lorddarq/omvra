const { randomUUID } = require('node:crypto');
const { DEFAULT_POLICY, normalizeCommand, safeError, fail } = require('./agent-work-contract.cjs');
const POLICY_KEY = 'omvra.agentWorkPolicy.v1';

// One coordinator per repository. Previews and operation receipts are bounded and process-local.
function createAgentWorkMaintenance({ repository, store }) {
  const previews = new Map();
  let admission = null;
  let operation = null, admitting = false, stopping = false, running = Promise.resolve();
  const copy = value => structuredClone(value);
  const busy = () => admitting || operation?.status === 'running';
  async function status() {
    return { metrics: await repository.metrics(), defaults: DEFAULT_POLICY, operation: copy(operation) };
  }
  async function preview(input) {
    if (!input || Object.keys(input).some(k=>!['action','policy'].includes(k)) || !['policy','prune','compact'].includes(input.action)) fail('INVALID_AGENT_WORK_INPUT');
    if (busy()) fail('AGENT_WORK_MAINTENANCE_BUSY');
    const proposed=input.action==='policy' ? normalizeCommand('setPolicy',input.policy) : undefined;
    if(input.action!=='policy' && input.policy!==undefined) fail('INVALID_AGENT_WORK_INPUT');
    const estimate=await repository.preview(proposed ? {policy:proposed} : {});
    const result={...estimate,id:randomUUID(),action:input.action,expiresAt:Date.now()+300000};
    if(result.action==='compact') { result.eligible=Object.fromEntries(Object.keys(result.eligible).map(k=>[k,0]));result.estimatedBytes=estimate.freeBytes; }
    for(const [id,p] of previews) if(p.expiresAt<Date.now()) previews.delete(id);
    if(previews.size>=8) previews.delete(previews.keys().next().value);
    previews.set(result.id,result);
    return copy(result);
  }
  async function execute(id) {
    if(admission) {
      if(admission.id===id)return admission.promise;
      fail('AGENT_WORK_MAINTENANCE_BUSY');
    }
    const promise=admit(id);
    admission={id,promise};
    try {return await promise;} finally {admission=null;}
  }
  async function admit(id) {
    if(typeof id!=='string' || id.length>80) fail('INVALID_AGENT_WORK_INPUT');
    if(previews.get(id)?.operation) return copy(previews.get(id).operation);
    if(stopping || busy()) fail('AGENT_WORK_MAINTENANCE_BUSY');
    const p=previews.get(id);
    if(!p || p.expiresAt<Date.now()) fail('AGENT_WORK_PREVIEW_STALE');
    admitting=true;
    try {
      const metrics=await repository.metrics();
      if(metrics.policyVersion!==p.policyVersion) fail('AGENT_WORK_PREVIEW_STALE');
      operation={id:randomUUID(),previewId:id,action:p.action,status:'running',deletedRows:0,summariesCleared:0,reclaimedBytes:0,batches:0,cancelRequested:false,startedAt:Date.now()};
      p.operation=operation;
      const admitted=copy(operation);
      // Return admission without awaiting database work. Each batch yields to foreground delivery.
      running=(async()=>{
        try {
          if(p.action==='policy') {
            const previous=store.get(POLICY_KEY);
            store.set(POLICY_KEY,p.policy);
            try { await repository.setPolicy(p.policy); }
            catch(error) { if(previous===undefined) store.delete(POLICY_KEY);else store.set(POLICY_KEY,previous);throw error; }
          } else {
            do {
              await new Promise(resolve=>setTimeout(resolve,50));
              if(operation.cancelRequested || stopping) break;
              const result=await repository[p.action]();
              operation.batches++;
              operation.deletedRows+=result.deletedRows || 0;
              operation.summariesCleared+=result.summariesCleared || 0;
              operation.reclaimedBytes+=result.reclaimedBytes || 0;
              if(result.deferred || result.busy) { operation.status='deferred';operation.reason=result.reason || 'database-busy';break; }
              if(!result.more) break;
              // An endlessly producing runtime cannot hold one manual operation indefinitely.
              if(operation.batches>=1000) { operation.status='deferred';operation.reason='batch-limit';break; }
            } while(true);
          }
          if(operation.status==='running') operation.status=operation.cancelRequested || stopping ? 'cancelled' : 'completed';
        } catch(error) { operation.status='failed';operation.error=safeError(error).code; }
        finally { operation.finishedAt=Date.now(); }
      })();
      return admitted;
    } finally { admitting=false; }
  }
  function cancel(id) {
    if(typeof id!=='string' || operation?.id!==id) fail('INVALID_AGENT_WORK_OPERATION');
    if(operation.status==='running' && operation.action!=='policy') operation.cancelRequested=true;
    return copy(operation);
  }
  return { status, preview, execute, cancel, async close() {stopping=true;await admission?.promise.catch(()=>{});await running;} };
}
module.exports={POLICY_KEY,createAgentWorkMaintenance};
