import { Plate } from "../../anatomy-kit/react/draw";
import { HandoffRigLive } from "./live";
import "./handoff-rig.css";

export function HandoffRigFigure() {
  return <div className="iso" data-theme="light">
    <Plate fig="Fig 01" title="Factory work-order conveyor" hint="Focus the rig · ← → advance · Enter accepts · R resets" readout="Task assigned · session ready" keys={[
      {mark:"lit",label:"The work order and its message"},
      {mark:"dashed",label:"ACP · live runtime control and progress"},
      {mark:"edge",label:"MCP · separate scoped workspace access"},
      {mark:"raised",label:"Submitted evidence awaiting human review"},
    ]} caption="A factory traveler rides to the operator; a wired intercom carries ACP session control, while a separate MCP key opens the records cabinet. Returned evidence waits at the review gate for a person to sign before the Goal beacon advances.">
      <HandoffRigLive />
    </Plate>
  </div>;
}
