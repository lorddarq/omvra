import { useEffect, useRef, useState } from 'react';
import type { RetentionPolicy } from '../../../../electron/services/agent-work-repository.cjs';
import type { DataPolicyAction, DataPolicyResult, DataPolicyStatus, PolicyPreview } from '../../../../electron/services/agent-work-maintenance.cjs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Dialog, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { DialogSurface } from '../dialogs/DialogSurface';

const fields: {key:Exclude<keyof RetentionPolicy,'automatic'>;label:string}[] = [
  {key:'sessionDays',label:'Session and turn history (days)'},{key:'sessions',label:'Closed sessions'},{key:'turns',label:'Finished turns'},
  {key:'eventDays',label:'Runtime event history (days)'},{key:'events',label:'Events across workspace'},{key:'eventsPerSession',label:'Events per session'},
  {key:'notificationDays',label:'Notification history (days)'},{key:'notifications',label:'Notifications'},
  {key:'summaryDays',label:'Finished summaries (days)'},{key:'projections',label:'Finished work summaries'},
];
const bytes=(n:number)=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(1)} KB`:`${(n/1048576).toFixed(2)} MB`;
const time=(n:number|null|undefined)=>n ? new Date(n).toLocaleString() : 'Not yet';
const names:Record<string,string>={sessions:'Sessions',turns:'Turns',events:'Runtime events',notifications:'Notifications',work_projections:'Work summaries',delivery_state:'Delivery cursors',summaries:'Turn summaries cleared'};
function unwrap<T>(result:DataPolicyResult<T>):T { if(result.ok===false) throw new Error(result.error);return result.value; }
const errorText=(error:unknown)=> {
  const code=error instanceof Error?error.message:'';
  return code==='AGENT_WORK_PREVIEW_STALE' ? 'The policy or preview changed. Review a fresh estimate before confirming.'
    : code==='INVALID_RETENTION_POLICY'||code==='INVALID_AGENT_WORK_NUMBER' ? 'Check the retention values. Summaries cannot outlive session history, and per-session events cannot exceed the workspace limit.'
    : code==='AGENT_WORK_MAINTENANCE_BUSY' ? 'A data operation is already running. Wait or cancel it before trying again.'
    : `Data operation failed${/^[A-Z_]+$/.test(code)?` (${code})`:''}. Refresh to try again.`;
};

export function DataPoliciesSettings() {
  const api=window.electron?.agentWork;
  const [status,setStatus]=useState<DataPolicyStatus|null>(null);
  const [draft,setDraft]=useState<RetentionPolicy|null>(null);
  const [preview,setPreview]=useState<PolicyPreview|null>(null);
  const [busy,setBusy]=useState(false), [error,setError]=useState('');
  const actionLock=useRef(false), mounted=useRef(true), trigger=useRef<HTMLButtonElement|null>(null);
  async function refresh(reset=false) {
    if(!api) return;
    const value=unwrap(await api.status());
    if(mounted.current) {setStatus(value);setDraft(current=>reset||!current?value.metrics.policy:current);}
  }
  useEffect(()=>{mounted.current=true;void refresh().catch(e=>setError(errorText(e)));return()=>{mounted.current=false;};},[api]);
  const running=status?.operation?.status==='running';
  useEffect(()=>{
    if(!running || !api) return;
    let cancelled=false;
    let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try { const next=unwrap(await api.status());if(!cancelled) {setStatus(next);if(next.operation?.action==='policy'&&next.operation.status==='completed')setDraft(next.metrics.policy);} }
      catch(e) {if(!cancelled)setError(errorText(e));}
      if(!cancelled)timer=setTimeout(poll,500);
    };
    timer=setTimeout(poll,500);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[running,api]);
  async function perform(action:()=>Promise<void>) {
    if(actionLock.current) return;
    actionLock.current=true;setBusy(true);setError('');
    try {await action();}catch(e){if(mounted.current)setError(errorText(e));}
    finally {actionLock.current=false;if(mounted.current)setBusy(false);}
  }
  const requestPreview=(action:DataPolicyAction)=>perform(async()=>{
    if(!api || !draft)return;
    setPreview(unwrap(await api.preview({action,...(action==='policy'?{policy:draft}:{})})));
  });
  if(!api)return <section aria-labelledby="data-policies-heading"><h3 id="data-policies-heading">Data policies</h3><p className="text-xs">Available in the desktop app.</p></section>;
  const m=status?.metrics,op=status?.operation;
  return <section aria-labelledby="data-policies-heading" className="space-y-3">
    <h3 id="data-policies-heading" className="text-sm font-semibold text-[#71717a]">Data policies</h3>
    <p className="text-xs text-[#6a7282]">Choose how long Omvra keeps local agent history. Active and recovery-critical snapshots remain protected. These settings do not delete provider-owned history or change your tasks.</p>
    {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
    {!draft||!m ? <><p role="status">Loading data policies…</p><Button onClick={()=>void perform(()=>refresh())} disabled={busy}>Retry</Button></> : <>
      <form className="space-y-3" onSubmit={e=>{e.preventDefault();void requestPreview('policy');}}>
        <fieldset disabled={busy||running} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-xs font-semibold">Retention</legend>
          {fields.map(({key,label})=><div key={key} className="space-y-1">
            <label htmlFor={`data-policy-${key}`} className="text-xs">{label}</label>
            {key.endsWith('Days') ? <select id={`data-policy-${key}`} className="h-9 w-full rounded-md border bg-transparent px-2 text-sm" value={draft[key]} onChange={e=>setDraft({...draft,[key]:Number(e.target.value)})}>{[1,7,30,90].map(day=><option key={day} value={day}>{day} days</option>)}</select>
              : <Input id={`data-policy-${key}`} type="number" required min={1} max={status!.defaults[key]*10} step={1} value={Number.isNaN(draft[key])?'':draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.valueAsNumber})}/>}
          </div>)}
          <div className="flex items-center gap-2 sm:col-span-2"><Switch id="data-policy-automatic" checked={draft.automatic} onCheckedChange={automatic=>setDraft({...draft,automatic})}/><label htmlFor="data-policy-automatic" className="text-xs">Automatic maintenance</label></div>
        </fieldset>
        <p className="text-xs text-[#6a7282]">Turning maintenance off keeps ingestion limits and storage-pressure protection active. Prune and compact remain available. Limits are positive and at most ten times their defaults.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy||running} onClick={e=>{trigger.current=e.currentTarget;}}>Review changes</Button>
          <Button type="button" size="sm" variant="outline" disabled={busy||running} onClick={()=>setDraft(status!.defaults)}>Reset to defaults</Button>
        </div>
      </form>
      <div className="space-y-2 rounded-xl border p-3 text-xs">
        <h4 className="font-semibold">Maintenance and diagnostics</h4>
        <p>Effective policy v{m.policyVersion}: automatic maintenance {m.policy.automatic?'on':'off'}. Events {m.policy.eventDays} days / {m.policy.events}; sessions {m.policy.sessionDays} days / {m.policy.sessions}; notifications {m.policy.notificationDays} days / {m.policy.notifications}; summaries {m.policy.summaryDays} days / {m.policy.projections}.</p>
        <p>State: {running?'busy':op?.status==='failed'?'failed':op?.status==='deferred'?'deferred':'idle'}. {op?.reason ? `Reason: ${op.reason}.` : m.policy.automatic?'Automatic checks run while idle.':'Waiting for a manual request.'}</p>
        <p>Database {bytes(m.databaseBytes)} · WAL {bytes(m.walBytes)} · Free pages {bytes(m.freeBytes)}</p>
        <p>Schema {m.schemaVersion} · {m.driver} · SQLite {m.sqliteVersion} · Node {m.nodeVersion}</p>
        <p>{Object.entries(m.counts).map(([k,n])=>`${names[k]||k}: ${n}`).join(' · ')}</p>
        <p>Protected sessions: {m.protectedRecords.count} (approximately {bytes(m.protectedRecords.estimatedBytes)} including recovery records). Oldest: {time(m.protectedRecords.oldest)}. Active, reusable and interrupted sessions retain recovery records; historical event detail can still expire.</p>
        <p>Last prune: {time(m.maintenance.lastPrune)} ({m.maintenance.pruneDurationMs} ms). Deleted rows this run: {m.maintenance.deletedRows}. Checkpoint: {time(m.maintenance.lastCheckpoint?.at)}. Compaction: {time(m.maintenance.lastCompaction?.at)}.</p>
        <p>Queue: {m.queue.depth} commands / {bytes(m.queue.bytes)}. Coalesced: {m.queue.coalescedCommands}. Rejected: {m.queue.rejectedCommands}. Last storage error: {m.queue.lastError?.code||m.maintenance.lastError?.code||'None'}.</p>
      </div>
      <div className="flex flex-wrap gap-2">{(['prune','compact'] as const).map(action=><Button key={action} variant="outline" size="sm" disabled={busy||running} onClick={e=>{trigger.current=e.currentTarget;void requestPreview(action);}}>{action==='prune'?'Prune now':'Compact database'}</Button>)}<Button size="sm" variant="outline" disabled={busy} onClick={()=>void perform(()=>refresh())}>Refresh</Button></div>
      {op&&<div role="status" aria-live="polite" className="space-y-2 text-xs"><p>{op.action==='policy'?'Policy update':op.action==='prune'?'Pruning':'Compaction'}: {op.status}. {op.batches} batches, {op.deletedRows} rows deleted, {op.summariesCleared} summaries cleared, {bytes(op.reclaimedBytes)} reclaimed.{op.error?` Error: ${op.error}.`:''}{op.reason?` ${op.reason}.`:''}</p>{running&&op.action!=='policy'&&<Button size="sm" variant="outline" disabled={busy||op.cancelRequested} onClick={()=>void perform(async()=>{unwrap(await api.cancel(op.id));await refresh();})}>{op.cancelRequested?'Stopping after current batch…':'Cancel operation'}</Button>}</div>}
    </>}
    <Dialog open={!!preview} onOpenChange={open=>{if(!open&&!busy)setPreview(null);}}>
      {/* Same layering as other confirmations opened from Settings: above the settings sheet without new z-index values. */}
      <DialogSurface overlayClassName="omvra-settings-overlay" className="max-w-lg gap-4 border border-black/5 bg-white p-6" onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus();}}>
        <DialogTitle>{preview?.action==='compact'?'Compact database?':preview?.action==='policy'?'Apply data policy?':'Prune agent history?'}</DialogTitle>
        <DialogDescription>{preview?.action==='compact'?'Reclaim free pages only. Zero history rows will be deleted. Compaction waits for idle storage and may be deferred while records need recovery.':'Eligible history is removed permanently under this policy. Protected snapshots are checked again in every batch. Completed deletions cannot be undone.'}</DialogDescription>
        {preview&&<div className="space-y-2 text-xs"><p>Automatic maintenance: {preview.policy.automatic?'on':'off'}. Event history: {preview.policy.eventDays} days; session history: {preview.policy.sessionDays} days; notifications: {preview.policy.notificationDays} days; summaries: {preview.policy.summaryDays} days.</p><p>Policy version {preview.policyVersion}. Estimates expire at {time(preview.expiresAt)}.</p><ul>{Object.entries(preview.eligible).map(([k,n])=><li key={k}>{names[k]||k}: {n}</li>)}</ul><p>Approximate {preview.action==='compact'?'reclaimable':'eligible'} bytes: {bytes(preview.estimatedBytes)}. Actual reclaimed space can differ.</p><p>{Object.entries(preview.protectedRecords.categories).map(([k,n])=>`Protected ${names[k]||k}: ${n}`).join(' · ')}</p><p>Protected sessions: {preview.protectedRecords.count} (approximately {bytes(preview.protectedRecords.estimatedBytes)}). {preview.protectedRecords.reason}</p></div>}
        {error&&<p role="alert" className="text-xs text-red-700">{error}</p>}
        <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setPreview(null)}>Keep current data</Button><Button disabled={busy} onClick={e=>{e.preventDefault();void perform(async()=>{
          if(!preview)return;
          try {const operation=unwrap(await api.execute(preview.id));setStatus(s=>s?{...s,operation}:s);setPreview(null);await refresh(operation.action==='policy'&&operation.status==='completed');}
          catch(e) {if(e instanceof Error&&e.message==='AGENT_WORK_PREVIEW_STALE') {setPreview(unwrap(await api.preview({action:preview.action,...(preview.action==='policy'?{policy:preview.policy}:{})})));}throw e;}
        });}}>{busy?'Starting…':'Confirm'}</Button></DialogFooter>
      </DialogSurface>
    </Dialog>
  </section>;
}
