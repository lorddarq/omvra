import { HandoffRigFigure } from './figures/handoff-rig/figure'

export default function Anatomy() {
  return <section id="anatomy" className="anatomy-section">
    <div className="landing-container">
      <header className="anatomy-heading">
        <p className="anatomy-kicker">FOLLOW ONE PIECE OF WORK</p>
        <h2>A task goes to an agent.<br/><span>Who says it’s done?</span></h2>
        <p>Follow a task from its instructions to agent work, submitted evidence, and a human review decision.</p>
      </header>
      <HandoffRigFigure />
      <p className="anatomy-footnote">Explore how the task reaches an agent and which workspace records it can access. Follow the evidence and human approval needed to advance this Goal; finishing an agent session alone does not advance it.</p>
    </div>
  </section>
}
