const test=require('node:test'),assert=require('node:assert/strict');
const {createRuntimeNotificationScheduler,LIMITS}=require('./agent-runtime-notifications.cjs');
function fixture(){let at=0,id=0,visible=false;const timers=new Map(),sent=[];
const scheduler=createRuntimeNotificationScheduler({now:()=>at,setTimer:(fn,delay)=>{timers.set(++id,{fn,at:at+delay});return id;},clearTimer:id=>timers.delete(id),isTaskVisible:()=>visible,send:n=>sent.push({...n,at})});
return {scheduler,sent,visible:v=>{visible=v;scheduler.visibilityChanged();},tick:ms=>{const end=at+ms;let guard=0;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(++guard<10000);at=next[1].at;timers.delete(next[0]);next[1].fn();}at=end;}};}
const binding=(id='b',state='active')=>({id,scope:{kind:'task',taskId:'t'},turn:{id:'turn',state},snapshotVersion:5});
const event=id=>({kind:'event',binding:binding(),event:{id,type:'tool'}});
test('quiet/max-wait aggregation, rate limiting and modal suppression use bounded queues',()=>{
 const f=fixture();for(let i=0;i<10000;i++)f.scheduler.accept(event(String(i)));
 assert.equal(f.scheduler.diagnostics().pending,1);assert.ok(f.scheduler.diagnostics().seen<=LIMITS.seen);
 f.tick(1999);assert.equal(f.sent.length,0);f.tick(1);assert.equal(f.sent.length,1);assert.equal(f.sent[0].safeSummary,'Agent activity updated');
 for(let i=0;i<6;i++){f.scheduler.accept(event('continuous-'+i));f.tick(1000);}assert.equal(f.sent.length,2);
 f.scheduler.accept(event('drop'));f.visible(true);f.tick(6000);assert.equal(f.sent.length,2);
 f.visible(false);f.scheduler.accept(event('later'));f.scheduler.dispose();assert.deepEqual(f.scheduler.diagnostics(),{pending:0,seen:0,timers:0});f.tick(10000);assert.equal(f.sent.length,2);
});
test('urgent input preempts quiet/visible slot, typed requests dedupe and terminal requires committed binding',()=>{
 const f=fixture();f.scheduler.accept(event('ordinary'));f.tick(2000);
 const urgent={kind:'binding',binding:binding('b','waiting-input'),requestId:1};f.scheduler.accept(urgent);f.scheduler.accept(urgent);f.tick(0);
 assert.equal(f.sent.length,2);assert.equal(f.sent[1].category,'permission');
 f.scheduler.accept({...urgent,requestId:'1'});f.tick(0);assert.equal(f.sent.length,3);
 f.scheduler.accept({kind:'event',binding:binding(),event:{id:'native-terminal',nativeEventType:'turn/completed'}});f.tick(4000);assert.equal(f.sent.length,3);
 const terminal={kind:'binding',binding:binding('b','completed')};f.scheduler.accept(terminal);f.scheduler.accept(terminal);f.tick(0);assert.equal(f.sent.length,4);assert.equal(f.sent[3].requiredVersion,5);
});
test('notification floods respect workspace/task caps while urgent candidates outrank ordinary detail',()=>{
 const f=fixture();for(let i=0;i<100;i++){const b=binding('b'+i,'waiting-input');b.scope.taskId='t'+i;f.scheduler.accept({kind:'binding',binding:b,requestId:i});}
 assert.equal(f.scheduler.diagnostics().pending,32);
 for(let i=0;i<20;i++)f.scheduler.accept({kind:'binding',binding:binding('same','waiting-input'),requestId:i});
 assert.ok(f.scheduler.diagnostics().pending<=32);f.tick(0);assert.ok(f.sent.every(n=>n.category==='permission'));f.scheduler.dispose();
});
test('stale committed projections cannot overwrite a newer active turn or notify its old completion',()=>{
 const f=fixture();const active=binding();active.snapshotVersion=20;active.turn.id='new-turn';
 f.scheduler.accept({kind:'binding',binding:active});
 f.scheduler.accept({kind:'binding',binding:binding('b','completed')});f.tick(10000);assert.equal(f.sent.length,0);
 f.scheduler.accept({kind:'event',binding:active,event:{id:'tool',type:'tool-state'}});f.tick(2000);assert.equal(f.sent.length,1);
});
test('resolved input and superseded turns remove pending candidates before presentation',()=>{
 const f=fixture();f.scheduler.accept({kind:'binding',binding:binding('b','waiting-input'),requestId:'x'.repeat(100000)});
 f.scheduler.accept({kind:'binding',binding:{...binding(),snapshotVersion:6}});f.tick(0);assert.equal(f.sent.length,0);
 f.scheduler.accept({kind:'binding',binding:{...binding('b','completed'),snapshotVersion:7}});
 f.scheduler.accept({kind:'binding',binding:{...binding(),turn:{id:'next',state:'active'},snapshotVersion:8}});f.tick(0);assert.equal(f.sent.length,0);
});
