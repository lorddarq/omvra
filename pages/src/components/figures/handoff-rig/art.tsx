import * as React from "react";
import { Dots, Line, Solid, Wire } from "../../anatomy-kit/react/draw";
import { iso } from "../../anatomy-kit/iso-kit";
import { BASE_ART, CONVEYOR, OPERATOR, ORDER, RECORDS, REVIEW, type Part } from "./geometry";
import { P, WIDTH, HEIGHT } from "./view";

const parts=(items:Part[],litId?:string)=>items.map(part=><Solid key={part.id} paths={part.paths} tone={part.tone} lit={part.lit||part.id===litId}/>);
const projected=(points:[number,number,number][])=>points.map(point=>iso(point,P));

export function HandoffArt({phase,acpFlow,onAccept}:{phase:number;acpFlow:boolean;onAccept:()=>void}){
  const origin=iso([0,0,0],P);
  const orderAt=phase===0?ORDER.start:ORDER.working;
  const orderPoint=iso(orderAt,P);
  const orderStyle={transform:`translate(${orderPoint[0]-origin[0]}px,${orderPoint[1]-origin[1]}px)`} as React.CSSProperties;
  const wire=(route:[number,number,number][],tone:"hi"|"lo",opts:{flow?:boolean;dashed?:boolean}={})=>{
    const points=projected(route);
    return <Wire from={points[0]!} via={points.slice(1,-1)} to={points.at(-1)!} tone={tone} size={1.6} {...opts}/>;
  };

  return <svg className="iso-svg hr-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="A factory conveyor carries one large work order to an operator. A wired intercom shows ACP session control; a separate key connects to a records cabinet through MCP. The returned evidence waits at a human review gate before the Goal beacon advances.">
    <path className="iso-halo" d={BASE_ART.slab.paths.fill}/>
    {parts(BASE_ART.feet)}
    <Solid paths={BASE_ART.slab.paths} tone="mid"/>

    {parts(RECORDS.cabinet)}
    {parts([RECORDS.door])}
    <Line d={RECORDS.shelves.join("")} tone="lo"/>
    {parts(OPERATOR.console)}
    {parts([OPERATOR.screen])}
    <Line d={OPERATOR.screenLines.join("")} tone="mid" free/>
    {parts(OPERATOR.handset)}
    {parts(RECORDS.key)}
    {wire(RECORDS.route,"lo",{dashed:true})}

    {parts(CONVEYOR.supports)}
    {parts([CONVEYOR.bed])}
    {parts(CONVEYOR.ends)}
    {parts(CONVEYOR.rails)}
    {parts([CONVEYOR.belt])}
    <Line d={CONVEYOR.slats.join("")} tone="lo"/>
    {wire(OPERATOR.acpRoute,"hi",{flow:acpFlow})}
    {acpFlow&&<Dots points={OPERATOR.messagePoints} size={1.8} tone="hi" pulse/>}

    <g className="co-order" style={orderStyle}>
      {parts([ORDER.board])}
      {parts([ORDER.sheet],"traveler-sheet")}
      {parts(ORDER.clip)}
      {parts([ORDER.header,...ORDER.lines,...ORDER.checks])}
      <Line d={ORDER.envelope+ORDER.flap} tone="mid"/>
    </g>

    {parts(REVIEW.tray)}
    {phase>=3&&<g className="co-evidence">{parts([REVIEW.paper],"evidence-sheet")}{parts(REVIEW.marks)}</g>}
    <g className={`co-stamp ${phase===4?"is-accepted":""}`} role="button" tabIndex={0} aria-label={phase===3?"Accept submitted evidence":phase===4?"Goal checkpoint advanced":"Human review gate; evidence has not been submitted"} aria-disabled={phase!==3} onClick={()=>phase===3&&onAccept()} onKeyDown={event=>{if((event.key==="Enter"||event.key===" ")&&phase===3){event.preventDefault();onAccept()}}}>
      {parts(REVIEW.stamp)}
      {parts([REVIEW.acceptLever])}
    </g>
    {parts([REVIEW.goal[0]])}
    <g className={`co-beacon ${phase===4?"is-on":""}`}>{parts([REVIEW.goal[1]])}</g>
  </svg>;
}
