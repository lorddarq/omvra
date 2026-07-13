const illustrationBase = `${import.meta.env.BASE_URL}illustrations`

const steps = [
  {
    title: 'Plan the work',
    description:
      'Lay out tasks on a visual timeline, group them by project, and make dates, dependencies, and priorities visible before work starts.',
    illustration: 'simple-delivery-01.svg',
    widthClassName: 'w-[9.4rem] md:w-[10.2rem]',
  },
  {
    title: 'Give work the right owner',
    description:
      'Move work through Kanban and assign it to yourself, a teammate, or an agent with the full task context attached.',
    illustration: 'simple-delivery-02.svg',
    widthClassName: 'w-[8.1rem] md:w-[8.75rem]',
  },
  {
    title: 'Review what comes back',
    description:
      'Agents update the workspace through controlled MCP access, then hand completed work back to a person with context and activity intact.',
    illustration: 'simple-delivery-03.svg',
    widthClassName: 'w-[7.2rem] md:w-[7.9rem]',
  },
] as const

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="bg-[#fbfaf8] py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance text-[clamp(2.9rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              From planning to
              <br />
              accountable delivery
            </h2>
            <p className="mx-auto mt-7 max-w-[40rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              <span className="font-semibold text-[#5b5966]">Omvra</span> keeps the planning surface,
              execution state, and review handoff in one local workspace.
              <br />
              Use AI where it helps, while the work stays visible and under your control.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-[72rem]">
            <div className="rounded-[1.75rem] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,247,244,0.96)_100%)] shadow-[0_2px_8px_rgba(17,24,39,0.04),0_16px_36px_rgba(17,24,39,0.04)]">
              <div className="grid md:grid-cols-3">
                {steps.map((step, index) => (
                  <article
                    key={step.title}
                    className={`relative flex flex-col items-start px-8 pb-10 pt-24 text-left md:min-h-[18.75rem] md:px-9 md:pb-9 md:pt-20 ${
                      index < steps.length - 1 ? 'border-b border-black/6 md:border-b-0 md:border-r' : ''
                    }`}
                  >
                    <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[28%] md:-translate-y-[38%]">
                      <img
                        src={`${illustrationBase}/${step.illustration}`}
                        alt=""
                        className={`h-auto ${step.widthClassName}`}
                        loading="lazy"
                      />
                    </div>

                    <h3 className="text-[2rem] font-medium leading-[1.1] tracking-[-0.05em] text-[#5b5966]">
                      {step.title}
                    </h3>
                    <p className="mt-5 max-w-[18rem] text-base text-[#77737c]">
                      {step.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
