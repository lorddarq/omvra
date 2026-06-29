const reasons = [
  {
    title: 'See the\nbig picture',
    description:
      'Plan work on a timeline, move it through Kanban. Spend less time translating status between tools.',
    illustration: 'Illustration01.svg',
    glow: 'bg-[radial-gradient(circle_at_50%_34%,rgba(239,229,123,0.55),transparent_56%)]',
  },
  {
    title: 'Keep things\nin one place',
    description:
      'Task details, markdown notes, comments, and review-ready handoffs stay attached to the work.',
    illustration: 'Illustration02.svg',
    glow: 'bg-[radial-gradient(circle_at_50%_34%,rgba(223,227,243,0.7),transparent_58%)]',
  },
  {
    title: 'Stay in control\nof your data',
    description:
      'Local-first and open source, with no account required, no hidden telemetry, and full-workspace backups.',
    illustration: 'Illustration03.svg',
    glow: 'bg-[radial-gradient(circle_at_50%_34%,rgba(255,208,107,0.5),transparent_56%)]',
  },
] as const

const trustPills = ['Open source', 'Local-first', 'No account required', 'Cross-platform']

const illustrationBase = `${import.meta.env.BASE_URL}illustrations`

const WhyOmvra = () => {
  return (
    <section id="why-omvra" className="bg-[#fbfaf8] py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance text-[clamp(2.7rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              Why should I use it?
            </h2>
            <div className="mx-auto mt-7 max-w-[48rem] space-y-7 text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              <p>
                Omvra is for people that want clear planning, fast execution, and less overhead.
                It gives them the visibility of a timeline, the momentum of Kanban, and the
                control of a local-first desktop app.
              </p>
              <p>
                Most tools are built to record what happened.
                <br />
                Omvra is built to tell you and your agents, what&apos;s next.
              </p>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
            {reasons.map((reason) => (
              <article
                key={reason.title}
                className="relative overflow-hidden rounded-[2rem] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(247,245,242,0.96)_100%)] px-8 pb-8 pt-8 shadow-[0_2px_6px_rgba(17,24,39,0.04),0_18px_40px_rgba(17,24,39,0.04)]"
              >
                <div aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-40 ${reason.glow}`} />
                <div className="relative">
                  <div className="flex justify-end">
                    <div className="flex size-32 items-center justify-center">
                      <img
                        src={`${illustrationBase}/${reason.illustration}`}
                        alt=""
                        className="h-32 w-32 object-contain"
                        loading="lazy"
                      />
                    </div>
                  </div>

                  <h3 className="mt-2 whitespace-pre-line text-[2.05rem] font-semibold leading-[1.15] tracking-[-0.05em] text-[#5a5866]">
                    {reason.title}
                  </h3>
                  <p className="mt-5 max-w-[18rem] text-base leading-8 text-[#77737c]">
                    {reason.description}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
            {trustPills.map((pill) => (
              <span
                key={pill}
                className="inline-flex items-center rounded-full border border-black/10 bg-white/75 px-4 py-1.5 text-sm font-medium text-[#7a7680] shadow-[0_1px_2px_rgba(17,24,39,0.03)]"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhyOmvra
