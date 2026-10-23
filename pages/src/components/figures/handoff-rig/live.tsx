import * as React from "react";
import { asksForStillness, useInView, useLoop, useReadout } from "../../anatomy-kit/react/live";
import { HandoffArt } from "./art";

const labels = ["Task assigned · session ready", "ACP session active · task still in progress", "Session ended · task still in progress", "Evidence submitted · review required", "Human accepted · Goal checkpoint advanced"];
const actions = ["Start ACP session", "End session", "Submit evidence", "Accept evidence", "Reset demonstration"];
const next = (phase:number) => Math.min(4,phase+1);

export function HandoffRigLive() {
  const {anchor,say} = useReadout<HTMLDivElement>();
  const root = anchor;
  const inView = useInView(root);
  const [phase,setPhase] = React.useState(0);
  const [paused,setPaused] = React.useState(false);
  const clock = React.useRef(0);
  const lastInput = React.useRef(0);
  const show = React.useCallback((value:number) => {
    setPhase(value);
    say(labels[value]!);
  },[say]);
  const kick = useLoop((dt,calm) => {
    if(calm || paused || !inView) return false;
    if(lastInput.current && performance.now()-lastInput.current<3600) return true;
    clock.current += dt;
    if(clock.current >= 3.6){ clock.current = 0; show((phase+1)%5); }
    return true;
  },inView && !paused && !asksForStillness());
  const interact = (value:number) => {
    lastInput.current = performance.now();
    clock.current = 0;
    show(value);
    kick();
  };
  const accept = () => { if(phase===3) interact(4); };
  const handleKey = (event:React.KeyboardEvent<HTMLDivElement>) => {
    if(event.key==="ArrowRight" || event.key===" ") { event.preventDefault(); interact(next(phase)); }
    else if(event.key==="ArrowLeft") { event.preventDefault(); interact(Math.max(0,phase-1)); }
    else if(event.key==="Enter") { event.preventDefault(); if(phase===3) accept(); else interact(next(phase)); }
    else if(event.key.toLowerCase()==="r") { event.preventDefault(); interact(0); }
  };
  const advance = () => interact(phase===4?0:next(phase));

  return <div className="hr-live-wrap">
    <div ref={root} className="hr-stage" tabIndex={0} role="application" aria-label="Interactive factory work-order conveyor" onKeyDown={handleKey} onPointerEnter={()=>setPaused(true)} onPointerLeave={()=>{lastInput.current=performance.now();setPaused(false)}} onFocus={()=>setPaused(true)} onBlur={()=>{lastInput.current=performance.now();setPaused(false)}}>
      <HandoffArt phase={phase} acpFlow={phase===1} onAccept={accept}/>
      <span className="hr-overview" aria-hidden="true">WORK ORDER <i>·</i> OPERATOR <i>·</i> REVIEW</span>
    </div>
    <div className="hr-controls" aria-label="Advance the demonstration">
      <span className="hr-control-label">DEMONSTRATION CONTROLS</span>
      <div className="hr-control-buttons">
        <button type="button" onClick={()=>interact(0)} aria-label="Reset demonstration">Reset</button>
        {phase < 4 && <button type="button" className="primary" onClick={advance}>{actions[phase]} <span aria-hidden="true">→</span></button>}
        {phase === 4 && <button type="button" className="primary" onClick={()=>interact(0)}>Run it again <span aria-hidden="true">↻</span></button>}
      </div>
      <p aria-live="polite">{labels[phase]}</p>
    </div>
  </div>;
}
