const reasons = [
  {
    title: 'Plan once.\nSee what is next.',
    description:
      'Plan on a timeline, move work through Kanban, and keep one shared view of schedules, status, and ownership.',
    illustration: 'Illustration01.svg',
    glow: 'bg-[linear-gradient(180deg,rgba(149,218,255,1)_20%,rgba(255,202,22,0.2)_100%)] blur-xl',
  },
  {
    title: 'Keep context\nwith the work.',
    description:
      'Tasks, notes, comments, dependencies, and review handoffs stay together instead of getting lost across tools.',
    illustration: 'Illustration02.svg',
    glow: 'bg-[linear-gradient(180deg,rgba(149,218,255,0.88)_20%,rgba(245,188,185,0.3)_100%)] blur-xl',
  },
  {
    title: 'Keep control\nof sensitive work.',
    description:
      'Local-first and open source, with no account required, no hosted workspace, and full-workspace backups.',
    illustration: 'Illustration03.svg',
    glow: 'bg-[linear-gradient(180deg,rgba(244,192,222,0.5)_20%,rgba(255,202,22,0.3)_100%)] blur-xl',
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
              Work faster without giving up control.
            </h2>
            <div className="mx-auto mt-7 max-w-[48rem] space-y-7 text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              <p>
                Omvra is for people who need clear planning and faster execution without moving
                sensitive project context into another cloud account.
              </p>
              <p>
                Most tools record what happened.
                <br />
                Omvra helps you and your agents know what is next—and who is accountable for it.
              </p>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
            {reasons.map((reason) => (
              <article
                key={reason.title}
                className="relative overflow-hidden rounded-[2rem] border border-black/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(247,245,242,0.96)_100%)] px-8 pb-8 pt-8 shadow-[0_2px_6px_rgba(17,24,39,0.04),0_18px_40px_rgba(17,24,39,0.04)]"
              >
                <div aria-hidden="true" className={`rounded-full pointer-events-none absolute inset-x-0 -top-60 h-130 w-130 left-1/2 -translate-x-1/2 ${reason.glow}`} />
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
                  <p className="mt-5 max-w-[18rem] text-base text-[#77737c]">
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
