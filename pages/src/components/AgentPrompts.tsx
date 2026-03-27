const promptExamples = [
  {
    title: 'Let an agent pick up assigned work',
    why: 'Best when you already assigned tasks to an agentic person in Plumy and want it to start with the right context.',
    prompt:
      'Connect to the Plumy MCP server, inspect the guide and assigned-work resources for the agent Codex, then summarize which tasks are actionable right now and start with the highest-priority one.',
  },
  {
    title: 'Work a single task without guessing',
    why: 'Best when you want the agent to inspect one task carefully before making any write calls.',
    prompt:
      'Using Plumy MCP, read the task execution guide and inspect task <TASK_ID>. Review the description, comments, project context, and current revision first. Then explain the execution plan before making any updates.',
  },
  {
    title: 'Hand off completed work cleanly',
    why: 'Best when you want the agent to leave a concise summary and move the card into human review in one safe flow.',
    prompt:
      'Use Plumy MCP to complete task <TASK_ID>. Keep the completion note brief, update the task through the high-level handoff workflow, and move it to Ready for human review when done.',
  },
  {
    title: 'Monitor a board for incoming work',
    why: 'Best for ongoing execution lanes where an agent should only react to new or changed cards.',
    prompt:
      'Watch the In Progress board through Plumy MCP for newly assigned tasks for Codex. Ignore duplicates, report only new actionable work, and tell me which card should be handled next.',
  },
]

const bestPractices = [
  'Name the person, board, or task explicitly instead of saying “look around.”',
  'Tell the agent to read the guide/schema first so it uses the intended MCP flow.',
  'Ask for a short plan before writes if the task is ambiguous or risky.',
  'For handoff flows, say “keep the completion note brief” so task descriptions stay clean.',
]

const AgentPrompts = () => {
  return (
    <section id="agent-prompts" className="py-28 bg-nordic-gray-50">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl font-light text-nordic-gray-800 mb-6 text-center">
            Advanced AI workflows, when you want them
          </h2>
          <p className="text-xl text-nordic-gray-600 font-light mb-16 text-center max-w-3xl mx-auto">
            AI support is optional in Plumy, but it is built to be structured when you need it. These examples show how teams can give assistants better context, safer handoff instructions, and clearer review expectations.
          </p>

          <div className="grid lg:grid-cols-2 gap-8">
            {promptExamples.map((example) => (
              <div key={example.title} className="rounded-2xl border border-nordic-gray-200 bg-white p-7 shadow-sm">
                <h3 className="text-2xl font-light text-nordic-gray-800 mb-3">{example.title}</h3>
                <p className="text-sm text-nordic-gray-500 font-light leading-relaxed mb-5">{example.why}</p>
                <div className="rounded-xl bg-nordic-gray-50 border border-nordic-gray-200 p-5">
                  <p className="text-sm uppercase tracking-[0.18em] text-nordic-blue mb-3">Sample Prompt</p>
                  <p className="text-nordic-gray-700 font-light leading-relaxed">{example.prompt}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-nordic-gray-200 bg-white p-8">
            <p className="text-sm uppercase tracking-[0.2em] text-nordic-blue font-light mb-4">Best Results</p>
            <ul className="grid md:grid-cols-2 gap-4 text-nordic-gray-600 font-light leading-relaxed">
              {bestPractices.map((item) => (
                <li key={item} className="rounded-xl bg-nordic-gray-50 border border-nordic-gray-200 px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AgentPrompts
