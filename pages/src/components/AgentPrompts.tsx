const promptExamples = [
  {
    title: 'Let Codex pick up assigned work',
    why: 'Best when you already assigned tasks to an agentic person in Omvra and want the assistant to start with the right context.',
    prompt:
      'Connect to Omvra MCP over stdio if available, inspect the guide and assigned-work resources for Codex, then summarize which tasks are actionable right now and start with the highest-priority one.',
  },
  {
    title: 'Work a single task without guessing',
    why: 'Best when you want the agent to inspect one task carefully before making any write calls.',
    prompt:
      'Using Omvra MCP, read the task execution guide and inspect task <TASK_ID>. Review the description, comments, project context, and current revision first. Then explain the execution plan before making any updates.',
  },
  {
    title: 'Hand off completed work cleanly',
    why: 'Best when you want the agent to leave a concise summary and move the card into human review in one safe flow.',
    prompt:
      'Use Omvra MCP to complete task <TASK_ID>. Keep the completion note brief, call the high-level review handoff workflow, and move it to Ready for human review when done.',
  },
  {
    title: 'Watch a board for incoming work',
    why: 'Best for ongoing execution lanes where an assistant should only react to new or changed cards.',
    prompt:
      'Watch the In Progress board through Omvra MCP for newly assigned tasks for Codex. Use board polling so duplicates are suppressed, report only new actionable work, and tell me which card should be handled next.',
  },
  {
    title: 'Connect work context across MCP servers',
    why: 'Best when the task lives in Omvra but the background lives in tools your team already uses.',
    prompt:
      'Use Omvra MCP as the planning source of truth, then consult connected MCP servers for Glean, Atlassian Rovo, Microsoft 365, and Figma as needed. Bring back only the relevant links, design context, decisions, and handoff notes to the Omvra task.',
  },
]

const bestPractices = [
  'Name the person, board, task, and external MCP source explicitly instead of saying "look around."',
  'Tell the agent to read the guide/schema first so it uses the intended MCP flow.',
  'Ask for a short plan before writes if the task is ambiguous or risky.',
  'For handoff flows, say "keep the completion note brief" so task descriptions stay clean.',
]

const AgentPrompts = () => {
  const featuredExamples = [promptExamples[0], promptExamples[4]]
  const supportingExamples = [promptExamples[1], promptExamples[2], promptExamples[3]]

  return (
    <section id="agent-prompts" className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-6 text-center text-4xl font-normal tracking-[-0.03em] text-black md:text-5xl">
            Human-to-agent workflows, when you want them
          </h2>
          <p className="mx-auto mb-14 max-w-4xl text-center text-lg font-normal leading-8 text-[#6B6B6B] md:mb-16 md:text-xl">
            Omvra gives MCP-capable assistants a structured planning surface, while other MCP servers can provide the company knowledge, tickets, documents, and designs around the work. Codex, Claude, and similar clients can help without turning the board into an unreviewed automation stream.
          </p>

          <div className="grid gap-10 lg:grid-cols-[minmax(18rem,0.92fr)_minmax(0,1.08fr)] lg:items-start">
            <div className="space-y-10">
              <div className="border-t border-black/10 pt-5">
                <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-[#838383]">
                  More ways to use it
                </p>
                <div className="space-y-5">
                  {supportingExamples.map((example) => (
                    <article
                      key={example.title}
                      className="grid gap-2 border-b border-black/8 pb-5 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] sm:gap-4"
                    >
                      <div>
                        <h3 className="text-xl font-medium leading-tight tracking-[-0.02em] text-black">
                          {example.title}
                        </h3>
                        <p className="mt-2 text-sm leading-5 text-[#5A5A5A]">{example.why}</p>
                      </div>
                      <p className="font-mono text-sm leading-5 text-[#2C2C2C]">
                        {example.title === 'Work a single task without guessing'
                          ? 'Read the task guide, inspect one task carefully, review description/comments/context first, then explain the plan before making updates.'
                          : example.title === 'Hand off completed work cleanly'
                            ? 'Complete the task through the review handoff workflow, keep the completion note brief, and leave status ready for a human.'
                            : 'Watch the active board for newly assigned Codex work, use board polling, ignore duplicates, and report only new actionable tasks.'}
                      </p>
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
                    <li key={item} className="flex gap-3 text-base leading-6 text-black">
                      <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#6c4fe0]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

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
                  <div className="grid gap-5 md:grid-cols-[minmax(0,0.74fr)_minmax(0,1fr)] md:gap-6">
                    <div>
                      <h3 className="mb-3 max-w-[16ch] text-2xl font-medium leading-tight tracking-[-0.03em] text-black">
                        {example.title}
                      </h3>
                      <p className="text-sm leading-5 text-[#5A5A5A]">{example.why}</p>
                    </div>
                    <div className="border-t border-black/8 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                      <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#838383]">Sample prompt</p>
                      <p className="font-mono text-[0.93rem] leading-5 text-[#2C2C2C]">
                        {index === 0
                          ? 'Connect to Omvra MCP over stdio if available, inspect the guide and assigned-work resources for Codex, summarize what is actionable now, then start with the highest-priority task.'
                          : 'Use Omvra as the task source of truth, consult Glean, Rovo, Microsoft 365, and Figma MCP where relevant, then bring concise links and decisions back to the task.'}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AgentPrompts
