const interfaces = [
  {
    title: 'Find the next\npiece of work',
    description:
      'Ask your connected assistant: “Read the project tasks and dependencies. Suggest what I should tackle next and explain what is blocked.”',
  },
  {
    title: 'Start with a\nclear brief',
    description:
      'Give the task a concrete outcome: “Fix the CSV export so accented names survive. Check the result and report any remaining limitations.”',
  },
  {
    title: 'Ask for evidence\nyou can review',
    description:
      'Set the handoff expectation: “Summarize the changes, list the checks you ran, and submit the work for review with anything I still need to verify.”',
  },
] as const

const AgentPrompts = () => {
  return (
    <section id="agent-prompts" className="bg-[#fbfaf8] py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-[46rem] text-center">
            <h2 className="text-balance text-[clamp(2.9rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              Give your agent a useful first task
            </h2>
            <p className="mx-auto mt-7 max-w-[43rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              Use these examples as a starting point once your agent is connected.
              Add the instructions to a task or ask your assistant to work from the existing project context.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
            {interfaces.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(248,247,244,0.96)_0%,rgba(245,243,240,0.96)_100%)] px-8 py-8 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]"
              >
                <div className="max-w-[18.7rem]">
                  <h3 className="whitespace-pre-line text-[2rem] font-medium leading-[1.15] tracking-[-0.05em] text-[#5b5966]">
                    {item.title}
                  </h3>
                  <p className="mt-6 text-base text-[#77737c]">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default AgentPrompts
