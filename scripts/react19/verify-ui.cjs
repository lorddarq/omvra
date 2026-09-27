// Isolated React 19 dependency interactions; no workspace or provider access.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
app.on('window-all-closed',()=>{});
(async()=>{
 const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'omvra-react19-')));
 app.setPath('userData',path.join(dir,'user-data'));
 let win;
 try {
  await fs.writeFile(path.join(dir,'index.html'),'<html><body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>');
  await fs.writeFile(path.join(dir,'entry.tsx'),`
import React,{useCallback,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {DndProvider,useDrag,useDrop} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import {TooltipProvider,Tooltip,TooltipTrigger,TooltipContent} from '${root}/src/app/components/ui/tooltip';
import {Button} from '${root}/src/app/components/ui/button';
import {Dialog,DialogTrigger,DialogContent,DialogTitle,DialogDescription,DialogClose} from '${root}/src/app/components/ui/dialog';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '${root}/src/app/components/ui/select';
import '${root}/src/styles/index.css';
window.probe={focus:0,childFocus:0,ref:0,cleanup:0};
function DragProbe(){const [dropped,setDropped]=useState(false);const [,drag]=useDrag(()=>({type:'probe',item:{id:1}}));const [,drop]=useDrop(()=>({accept:'probe',drop:()=>{setDropped(true);}}));return <><div id="drag" ref={node=>{drag(node);}}>Drag</div><div id="drop" ref={node=>{drop(node);}}>{dropped?'Dropped':'Drop here'}</div></>;}
function Probe(){const [shown,setShown]=useState(true),[value,setValue]=useState('one');const ref=useCallback(node=>{if(node){window.probe.ref++;return ()=>{window.probe.cleanup++;};}},[]);return <main>
<TooltipProvider delayDuration={0}>{shown&&<Tooltip><TooltipTrigger asChild onFocus={()=>{window.probe.focus++;}}><Button id="tip" ref={ref} onFocus={()=>{window.probe.childFocus++;}}>Tip</Button></TooltipTrigger><TooltipContent>Tooltip content</TooltipContent></Tooltip>}</TooltipProvider>
<button id="unmount" onClick={()=>setShown(false)}>Unmount</button>
<Dialog><DialogTrigger asChild><Button id="dialog">Dialog</Button></DialogTrigger><DialogContent><DialogTitle>Compatibility dialog</DialogTitle><DialogDescription>Dependency smoke check</DialogDescription><DialogClose id="close">Close</DialogClose></DialogContent></Dialog>
<Select value={value} onValueChange={setValue}><SelectTrigger id="select"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="one">One</SelectItem><SelectItem value="two">Two</SelectItem></SelectContent></Select><output id="value">{value}</output>
<DndProvider backend={HTML5Backend}><DragProbe/></DndProvider></main>;}
createRoot(document.getElementById('root')).render(<Probe/>);`);
  const {build}=await import('vite');
  await build({configFile:path.join(root,'vite.config.ts'),root:dir,resolve:{alias:{react:path.join(root,'node_modules/react'),'react-dom':path.join(root,'node_modules/react-dom'),'react-dnd':path.join(root,'node_modules/react-dnd'),'react-dnd-html5-backend':path.join(root,'node_modules/react-dnd-html5-backend')}},build:{outDir:path.join(dir,'dist'),emptyOutDir:true},logLevel:'error'});
  await app.whenReady();
  win=new BrowserWindow({show:false,width:900,height:700,webPreferences:{contextIsolation:true,nodeIntegration:false}});
  const errors=[];win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(event.message);});
  await win.loadFile(path.join(dir,'dist/index.html'));
  const js=code=>win.webContents.executeJavaScript(code,true);
  async function waitFor(expression,attempts=100){for(let i=0;i<attempts;i++){if(await js(expression))return;await new Promise(resolve=>setTimeout(resolve,30));}throw new Error('UI timeout: '+expression+' '+JSON.stringify(await js('({probe:window.probe,active:document.activeElement?.id})'))+' '+errors.join('\n'));}
  await waitFor("!!document.querySelector('#tip')");
  await js("document.querySelector('#tip').dispatchEvent(new FocusEvent('focusin',{bubbles:true}))");
  await waitFor("!!document.querySelector('[role=tooltip]')",10);
  assert.deepEqual(await js('({focus:window.probe.focus,child:window.probe.childFocus})'),{focus:1,child:1});
  await js("document.querySelector('#unmount').click()");
  await waitFor("!document.querySelector('[role=tooltip]')");
  assert.ok(await js('window.probe.ref>0 && window.probe.ref===window.probe.cleanup'));
  await js("document.querySelector('#dialog').click()");
  await waitFor("!!document.querySelector('[role=dialog]')");
  await js("document.querySelector('#close').click()");
  await waitFor("!document.querySelector('[role=dialog]')");
  await js("document.querySelector('#select').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))");
  await waitFor("!!document.querySelector('[role=option]')");
  await js("[...document.querySelectorAll('[role=option]')].find(e=>e.textContent==='Two').click()");
  await waitFor("document.querySelector('#value').textContent==='two'");
  await js("{const dataTransfer=new DataTransfer();for(const [id,type] of [['drag','dragstart'],['drop','dragenter'],['drop','dragover'],['drop','drop'],['drag','dragend']])document.getElementById(id).dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer}));}");
  await waitFor("document.querySelector('#drop').textContent==='Dropped'");
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:['tooltip composed focus handlers and zero delay','React 19 callback ref cleanup','dialog portal','select value changes','HTML5 drag and drop']},null,2));
 } finally {win?.destroy();await fs.rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
 app.exit(0);
})().catch(error=>{console.error(error);app.exit(1);});
