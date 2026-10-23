import { HandoffRigFigure } from './figures/handoff-rig/figure'

export default function Anatomy() {
  return <section id="anatomy" className="anatomy-section">
    <div className="landing-container">
      <header className="anatomy-heading">
        <p className="anatomy-kicker">FOLLOW ONE PIECE OF WORK</p>
        <h2>A task goes to an agent.<br/><span>Who says it’s done?</span></h2>
        <p>Follow a single work order as it reaches an agent, uses controlled workspace access, and returns for human review.</p>
      </header>
      <HandoffRigFigure />
      <p className="anatomy-footnote">Start the intercom to see live ACP messages travel to the operator. The separate MCP key opens approved workspace records; a finished order still needs evidence and a human sign-off before the Goal marker advances.</p>
    </div>
  </section>
}
