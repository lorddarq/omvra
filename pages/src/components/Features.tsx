const illustrationBase = `${import.meta.env.BASE_URL}illustrations`
const iconBase = `${import.meta.env.BASE_URL}icons`

const spotlightCards = [
  {
    title: 'One plan from\nstart to finish',
    description:
      'Schedule work visually, execute it in Kanban, and keep dates, status, milestones, and dependencies connected.',
    illustration: 'what-can-do-01.svg',
    chips: ['Timeline', 'Kanban', 'Roadmap'],
    minHeight: 'md:min-h-[30.25rem]',
  },
  {
    title: 'A workspace for people\nand agents',
    description:
      'Assign work to an agent the same way you would assign it to a teammate—or yourself.',
    extra:
      'The task carries its context, so you spend less time copying instructions between tools.',
    illustration: 'what-can-do-02.svg',
    chips: ['MCP STDIO', 'MCP HTTP'],
    minHeight: 'md:min-h-[33.25rem]',
  },
  {
    title: 'AI with a clear\nhandoff',
    description:
      'Let Codex, Claude, or another MCP-capable assistant read task context, make controlled updates, and hand work back for human review.',
    illustration: 'what-can-do-03.svg',
    chips: ['Codex', 'Claude Code', 'Agentic-capable LLMs'],
    minHeight: 'md:min-h-[29.5rem]',
  },
] as const

const supportingFeatures = [
  {
    title: 'See what is coming',
    description:
      'Use timeline planning, swimlanes, and date resizing to spot collisions before they block delivery.',
    icon: 'what-can-do-icon-01.svg',
  },
  {
    title: 'Make ownership visible',
    description:
      'Organize tasks by status and owner so prioritization, handoffs, and review take less effort.',
    icon: 'what-can-do-icon-02.svg',
  },
  {
    title: 'Coordinate the whole plan',
    description:
      'Connect projects, milestones, and dependencies without maintaining separate plans for the same work.',
    icon: 'what-can-do-icon-03.svg',
  },
  {
    title: 'Make blockers visible',
    description:
      'Group work into milestones and see the dependencies that can slow delivery.',
    icon: 'what-can-do-icon-04.svg',
  },
  {
    title: 'Keep evidence with the task',
    description:
      'Keep notes, comments, local file references, and handoff details attached to the work.',
    icon: 'what-can-do-icon-05.svg',
  },
  {
    title: 'Catch overload early',
    description:
      'See execution and pipeline load early enough to rebalance work before it blocks delivery.',
    icon: 'what-can-do-icon-06.svg',
  },
  {
    title: 'Own and move your workspace',
    description:
      'Back up the full workspace, inspect storage, and move your data without depending on a hosted account.',
    icon: 'what-can-do-icon-07.svg',
  },
] as const

const supportNotes = [
  {
    label: 'Human in the loop',
    body:
      "When an agent finishes work, Omvra hands the task back to you for review instead of silently closing the loop.",
  },
  {
    label: 'Connection',
    body:
      'For MCP use STDIO or local HTTP with token and capability controls when you need a URL.',
  },
  {
    label: 'Visibility',
    body:
      'Audit logs, listener status, and health checks make agent access easier to inspect and debug.',
  },
  {
    label: 'Watchers',
    body:
      'Agents can watch a chosen board, project, and search filter for new or changed work.',
  },
] as const

const chipClassName =
  'inline-flex items-center rounded-full bg-[#f1f1f3] px-3 py-1 text-[0.7rem] font-medium tracking-[-0.01em] text-[#7b7680]'

const Features = () => {
  return (
    <section id="features" className="bg-[#fbfaf8] py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance text-[clamp(2.7rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              What can it do?
            </h2>
            <p className="mx-auto mt-7 max-w-[48rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              Every part of the product is aimed at the same outcome: clearer planning, smoother
              execution, and less work lost between tools.
            </p>
          </div>

          <div className="mt-16 grid gap-8 xl:grid-cols-[minmax(0,560px)_minmax(0,560px)] xl:items-start xl:gap-8">
            <div className="space-y-8">
              {spotlightCards.map((card) => (
                <article
                  key={card.title}
                  className={`relative overflow-hidden rounded-[2rem] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,246,243,0.96)_100%)] px-8 pb-9 pt-8 shadow-[0_2px_8px_rgba(17,24,39,0.04),0_16px_36px_rgba(17,24,39,0.04)] ${card.minHeight}`}
                >
                  <div className="relative flex flex-col items-center text-center">
                    <div className="flex size-32 items-center justify-center">
                      <img
                        src={`${illustrationBase}/${card.illustration}`}
                        alt=""
                        className="h-32 w-32 object-contain"
                        loading="lazy"
                      />
                    </div>

                    <h3 className="mt-4 whitespace-pre-line text-balance text-[2rem] font-medium leading-[1.14] tracking-[-0.05em] text-[#5a5866] md:text-[2.25rem]">
                      {card.title}
                    </h3>

                    <p className="mt-5 max-w-[20rem] text-base text-[#77737c]">
                      {card.description}
                    </p>

                    {card.extra ? (
                      <p className="mt-5 max-w-[20rem] text-base text-[#8a8690]">
                        {card.extra}
                      </p>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      {card.chips.map((chip) => (
                        <span key={chip} className={chipClassName}>
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(245,244,241,0.96)_0%,rgba(242,240,236,0.96)_100%)] px-8 py-6 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)] md:px-9 md:py-7">
              <div className="divide-y divide-black/8">
                {supportingFeatures.map((feature) => (
                  <article key={feature.title} className="grid gap-3 py-6 sm:grid-cols-[24px_minmax(0,1fr)] sm:gap-4">
                    <div className="flex items-start justify-center pt-0.5">
                      <img
                        src={`${iconBase}/${feature.icon}`}
                        alt=""
                        className="h-6 w-6 object-contain opacity-35"
                        loading="lazy"
                      />
                    </div>
                    <div>
                      <h3 className="text-[1.35rem] font-semibold leading-tight tracking-[-0.035em] text-[#66626c]">
                        {feature.title}
                      </h3>
                      <p className="mt-3 max-w-[24rem] text-[0.97rem] text-[#807c84]">
                        {feature.description}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 border-t border-black/6 pt-8">
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4 xl:gap-10">
              {supportNotes.map((note) => (
                <article key={note.label}>
                  <h3 className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#918c95]">
                    {note.label}
                  </h3>
                  <p className="mt-3 max-w-[16rem] text-sm leading-6 text-[#86818a]">
                    {note.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Features
