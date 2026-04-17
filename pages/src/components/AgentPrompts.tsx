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
    <section id="agent-prompts" className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-6 text-center text-4xl font-normal tracking-[-0.03em] text-black md:text-5xl">
            Advanced AI workflows, when you want them
          </h2>
          <p className="mx-auto mb-14 max-w-4xl text-center text-lg font-normal leading-8 text-[#6B6B6B] md:mb-16 md:text-xl">
            AI support is optional in Plumy, but it is built to be structured when you need it. These examples show how teams can give assistants better context, safer handoff instructions, and clearer review expectations.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            {promptExamples.map((example) => (
              <div
                key={example.title}
                className="rounded-3xl border border-black/8 bg-[#FCFCFC] p-6 transition-all duration-200 hover:border-black/15 hover:shadow-[0_16px_30px_rgba(0,0,0,0.05)] md:p-7"
              >
                <h3 className="mb-3 max-w-[18ch] text-2xl font-medium leading-tight tracking-[-0.02em] text-black">
                  {example.title}
                </h3>
                <p className="mb-5 text-sm font-normal leading-6 text-[#5A5A5A]">{example.why}</p>
                <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-5">
                  <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-[#838383]">Sample Prompt</p>
                  <p className="text-sm font-normal leading-6 text-[#2C2C2C] md:text-[15px]">
                    {example.prompt}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <p className="mb-4 text-center text-2xl font-normal text-[#838383]">Tips</p>
            <div className="rounded-3xl bg-white p-5 md:p-6">
              <ul className="grid gap-4 md:grid-cols-2">
                {bestPractices.map((item) => (
                  <li
                    key={item}
                    className="rounded-2xl border border-[#E6E6E6] bg-white px-4 py-4 text-base font-normal leading-7 text-black transition-colors duration-200 hover:border-[#D5CEF1] hover:bg-[#FAFAFA]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AgentPrompts
