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
  const featuredExamples = [promptExamples[0], promptExamples[2]]
  const supportingExamples = [promptExamples[1], promptExamples[3]]

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

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(18rem,0.98fr)] lg:items-start">
            <div className="space-y-6">
              {featuredExamples.map((example, index) => (
                <article
                  key={example.title}
                  className="rounded-[28px] bg-[#fbfbfb] p-6 md:p-7"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium uppercase tracking-[0.2em] text-[#6c4fe0]">
                      Example 0{index + 1}
                    </span>
                    <span className="text-sm font-medium text-black/40">Curated workflow</span>
                  </div>
                  <div className="grid gap-5 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] md:gap-6">
                    <div>
                      <h3 className="mb-3 max-w-[16ch] text-2xl font-medium leading-tight tracking-[-0.03em] text-black">
                        {example.title}
                      </h3>
                      <p className="text-sm leading-6 text-[#5A5A5A]">{example.why}</p>
                    </div>
                    <div className="border-t border-black/8 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                      <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#838383]">Sample prompt</p>
                      <p className="font-mono text-[0.95rem] leading-7 text-[#2C2C2C]">
                        {example.prompt}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="space-y-10">
              <div className="border-t border-black/10 pt-5">
                <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-[#838383]">
                  More ways to use it
                </p>
                <div className="space-y-5">
                  {supportingExamples.map((example) => (
                    <article key={example.title} className="grid gap-2 border-b border-black/8 pb-5 last:border-b-0 last:pb-0">
                      <h3 className="text-xl font-medium leading-tight tracking-[-0.02em] text-black">
                        {example.title}
                      </h3>
                      <p className="text-sm leading-6 text-[#5A5A5A]">{example.why}</p>
                      <p className="font-mono text-sm leading-6 text-[#2C2C2C]">{example.prompt}</p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="border-t border-black/10 pt-5">
                <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-[#838383]">
                  Prompting tips
                </p>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {bestPractices.map((item) => (
                    <li key={item} className="flex gap-3 text-base leading-7 text-black">
                      <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#6c4fe0]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AgentPrompts
