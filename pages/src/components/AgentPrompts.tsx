const interfaces = [
  {
    title: 'Coordinate and\norchestrate work',
    description:
      'Direct and instruct agents on preferred workflows and solutions at agent setup and manage a whole team at once.',
  },
  {
    title: 'Let agents pick up\nassigned work',
    description:
      'Best when you already assigned tasks to an agentic person in Omvra and want the assistant to start with the right context.',
  },
  {
    title: 'Connect work across\nMCP servers',
    description:
      'Best when the task lives in Omvra but the background information lives in tools across several systems already in use.',
  },
] as const

const AgentPrompts = () => {
  return (
    <section id="agent-prompts" className="bg-[#fbfaf8] py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-[46rem] text-center">
            <h2 className="text-balance text-[clamp(2.9rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              A shared interface between
              <br />
              you and your agents
            </h2>
            <p className="mx-auto mt-7 max-w-[43rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              With MCP-capable assistants, it offers a planning surface, while other MCP servers
              can provide contextual knowledge, and designs around the work.
              <br />
              Codex, Claude, and other agents can help take off the load.
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
