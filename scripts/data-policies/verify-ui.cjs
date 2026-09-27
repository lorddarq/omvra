// Isolated Electron smoke check: actual component, preload, IPC and SQLite; no user workspace.
const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'../..');
const {createAgentWorkRepository}=require('../../electron/services/agent-work-repository.cjs');
const {createAgentWorkMaintenance}=require('../../electron/services/agent-work-maintenance.cjs');
const {registerAgentWorkIpcHandlers}=require('../../electron/ipc/agent-work.cjs');
app.on('window-all-closed',()=>{});
(async()=>{
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'omvra-policy-ui-')));
 app.setPath('userData',path.join(dir,'user-data'));
 const values=new Map(),store={path:path.join(dir,'store.json'),get:k=>values.get(k),set:(k,v)=>values.set(k,v),delete:k=>values.delete(k)};
 let repo,maintenance,win,releasePrune,holdPrune=false;
 try {
  await fs.writeFile(path.join(dir,'index.html'),'<html><head><title>Omvra data policies verification</title></head><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
  await fs.writeFile(path.join(dir,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {DataPoliciesSettings} from ${JSON.stringify(path.join(root,'src/app/components/settings/DataPoliciesSettings.tsx'))};import ${JSON.stringify(path.join(root,'src/styles/index.css'))};createRoot(document.getElementById('root')!).render(<main className="mx-auto max-w-3xl p-6"><h1>Settings → Storage</h1><DataPoliciesSettings/></main>);`);
  const {build}=await import('vite');
  await build({configFile:path.join(root,'vite.config.ts'),root:dir,resolve:{alias:{react:path.join(root,'node_modules/react'),'react-dom':path.join(root,'node_modules/react-dom')}},build:{outDir:path.join(dir,'dist'),emptyOutDir:true},logLevel:'error'});
  repo=await createAgentWorkRepository({storePath:store.path,policy:{automatic:false},maintenanceSuspended:true});
  const recovery=(await repo.createSession({runtimeProfileId:'runtime',scope:{kind:'task',taskId:'recovery-task',executionAttemptId:'recovery-attempt',taskRevision:1},idempotencyKey:'recovery'})).binding;
  await repo.updateSession({bindingId:recovery.id,expectedRevision:recovery.revision,state:'interrupted'});
  const b=(await repo.createSession({runtimeProfileId:'runtime',scope:{kind:'task',taskId:'task',executionAttemptId:'attempt',taskRevision:3},idempotencyKey:'binding',turn:{id:'turn',state:'active'}})).binding;
  for(let n=0;n<450;n++)await repo.appendEvent({bindingId:b.id,runtimeProfileId:'runtime',turnId:'turn',kind:'tool',idempotencyKey:`event-${n}`});
  const db=new DatabaseSync(path.join(dir,'store','agent-work-v1.sqlite'));db.prepare('UPDATE agent_events SET created_at=?').run(Date.now()-40*86400000);db.close();
  maintenance=createAgentWorkMaintenance({repository:{...repo,prune:async()=>{
    const result=await repo.prune();
    // Hold one completed batch so cancellation is deterministic even on a busy GUI host.
    if(holdPrune)await new Promise(resolve=>{releasePrune=resolve;});
    return result;
  }},store});
  registerAgentWorkIpcHandlers({ipcMain,ready:Promise.resolve({maintenance})});
  await app.whenReady();
  win=new BrowserWindow({show:false,width:1000,height:1000,webPreferences:{preload:path.join(root,'electron/preload.cjs'),contextIsolation:true,nodeIntegration:false,partition:'data-policy-test'}});
  const errors=[];win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  await win.loadFile(path.join(dir,'dist/index.html'));
  const js=code=>win.webContents.executeJavaScript(code,true);
  async function waitFor(expression){for(let n=0;n<150;n++){if(await js(expression))return;await new Promise(r=>setTimeout(r,30));}throw new Error('UI timeout: '+expression);}
  const click=label=>js(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  await waitFor("!!document.querySelector('#data-policy-events')");
  assert.equal(await js("document.querySelectorAll('label[for^=data-policy]').length"),11);
  await click('Prune now');await waitFor("!!document.querySelector('[role=dialog]')");
  assert.match(await js("document.querySelector('[role=dialog]').textContent"),/Runtime events: 450/);
  assert.match(await js("document.querySelector('[role=dialog]').textContent"),/Protected sessions: 2/);
  // Real keyboard events move inside the dialog and Escape cancels without touching history.
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Tab'});
  await new Promise(r=>setTimeout(r,50));
  assert.equal(await js("!!document.activeElement.closest('[role=dialog]')"),true);
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  await waitFor("!document.querySelector('[role=dialog]')");
  assert.equal((await repo.metrics()).counts.events,450);
  await click('Compact database');await waitFor("!!document.querySelector('[role=dialog]')");
  assert.match(await js("document.querySelector('[role=dialog]').textContent"),/Zero history rows/);
  await click('Confirm');await waitFor("document.body.textContent.includes('Compaction: deferred')");
  assert.equal((await repo.metrics()).counts.events,450);
  await click('Prune now');await waitFor("!!document.querySelector('[role=dialog]')");
  holdPrune=true;
  await click('Confirm');await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Cancel operation'&&!b.disabled)");
  for(let n=0;n<200&&!releasePrune;n++)await new Promise(r=>setTimeout(r,10));
  assert.ok(releasePrune,'first real pruning batch completed');
  await click('Cancel operation');
  for(let n=0;n<200&&!(await maintenance.status()).operation.cancelRequested;n++)await new Promise(r=>setTimeout(r,10));
  assert.equal((await maintenance.status()).operation.cancelRequested,true);
  holdPrune=false;releasePrune();
  await waitFor("document.body.textContent.includes('Pruning: cancelled')");
  assert.equal((await repo.snapshot({bindingId:b.id})).turn.state,'active');
  await click('Prune now');await waitFor("!!document.querySelector('[role=dialog]')");
  await click('Confirm');await waitFor("document.body.textContent.includes('Pruning: completed')");
  assert.equal((await repo.metrics()).counts.events,0);assert.equal((await repo.snapshot({bindingId:b.id})).turn.state,'active');assert.equal((await repo.snapshot({bindingId:recovery.id})).binding.state,'interrupted');
  // A stale policy preview is refreshed, never silently executed.
  await click('Review changes');await waitFor("!!document.querySelector('[role=dialog]')");
  await repo.setPolicy({automatic:false});await click('Confirm');
  await waitFor("document.body.textContent.includes('Review a fresh estimate')");
  assert.equal(await js("!!document.querySelector('[role=dialog]')"),true);
  await click('Confirm');await waitFor("document.body.textContent.includes('Policy update: completed')");
  assert.equal(errors.length,0,errors.join('\n'));
  await new Promise(r=>setTimeout(r,250));
  const screenshot=path.join(os.tmpdir(),'omvra-data-policies.png');await fs.writeFile(screenshot,(await win.webContents.capturePage()).toPNG());
  console.log(JSON.stringify({passed:true,checks:['real preload/IPC/SQLite','labels','dialog keyboard focus/Escape','protected preview','zero-delete compaction','UI cancellation','prune retains active and interrupted snapshots','stale confirmation refresh','policy update'],screenshot},null,2));
 } finally {releasePrune?.();win?.destroy();await maintenance?.close();await repo?.close();await fs.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 app.exit(0);
})().catch(e=>{console.error(e);app.exit(1);});
