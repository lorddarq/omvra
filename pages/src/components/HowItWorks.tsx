const steps = [
  {
    number: '01',
    title: 'Plan the work',
    description:
      'Lay out tasks on a visual timeline, group them by project or swimlane, and see what is happening next without building a heavyweight process around it.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M1 2.33333L3 4.33333L6.33333 1M1 10.3333L3 12.3333L6.33333 9M1 18.3333L3 20.3333L6.33333 17M11 3H23M11 11H23M11 19H23" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Move it through execution',
    description:
      'Switch to Kanban when it is time to ship, reorder priorities quickly, and keep ownership, notes, and status changes tied to the same task.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 25 27">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.3333 14.9057C9.08714 13.6842 7.41168 13 5.66667 13C3.92165 13 2.24619 13.6842 1 14.9057M1 14.9057V2.90571C2.24619 1.6842 3.92165 1 5.66667 1C7.41168 1 9.08714 1.6842 10.3333 2.90571C11.5795 4.12723 13.255 4.81143 15 4.81143C16.745 4.81143 18.4205 4.12723 19.6667 2.90571V10.9057M1 14.9057V24.2389M21.2669 23.1725L23.6669 25.5725M14.3333 20.2389C14.3333 21.2998 14.7548 22.3172 15.5049 23.0674C16.2551 23.8175 17.2725 24.2389 18.3333 24.2389C19.3942 24.2389 20.4116 23.8175 21.1618 23.0674C21.9119 22.3172 22.3333 21.2998 22.3333 20.2389C22.3333 19.1781 21.9119 18.1607 21.1618 17.4105C20.4116 16.6604 19.3942 16.2389 18.3333 16.2389C17.2725 16.2389 16.2551 16.6604 15.5049 17.4105C14.7548 18.1607 14.3333 19.1781 14.3333 20.2389Z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Review and hand off cleanly',
    description:
      'Use comments, markdown details, and optional MCP-powered agent workflows to keep handoffs concise, visible, and easy for humans to review.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 26 26">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13L11.6667 15.6667L17 10.3333M13 1C22.6 1 25 3.4 25 13C25 22.6 22.6 25 13 25C3.4 25 1 22.6 1 13C1 3.4 3.4 1 13 1Z" />
      </svg>
    ),
  },
]

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      className="bg-[radial-gradient(circle_at_top,rgba(108,79,224,0.08),transparent_38%),linear-gradient(180deg,#fafafa_0%,#f3f4f6_100%)] py-24 md:py-28"
    >
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center md:mb-16">
            <div className="mb-5 inline-flex items-center justify-center rounded-full border border-[#6c4fe0]/25 bg-white/80 px-4 py-1.5 text-sm font-medium text-[#6c4fe0]">
              How it works
            </div>
            <h2
              className="mb-6 text-4xl font-medium leading-[1.08] tracking-[-0.03em] text-[#101828] md:text-5xl"
              style={{ fontFamily: 'Figtree, sans-serif' }}
            >
              A simple flow from planning to delivery
            </h2>
            <p className="text-lg leading-8 text-[#4a5565] md:text-xl">
              Plumy is designed to be easy to understand on day one. You plan visually, execute in the same
              workspace, and keep handoffs clean without adding another cloud service to manage.
            </p>
          </div>

          <div className="relative">
            <div className="absolute bottom-0 left-5 top-0 w-px bg-black/10 lg:left-0 lg:right-0 lg:top-16 lg:h-px lg:w-auto" />
            <div className="grid gap-12 lg:grid-cols-3 lg:gap-10 xl:gap-14">
              {steps.map((step, index) => (
                <article key={step.number} className="relative pl-14 lg:pl-0">
                  <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full border border-[#6c4fe0]/18 bg-white text-sm font-semibold tracking-[0.2em] text-[#6c4fe0] lg:static lg:mb-8">
                    {step.number}
                  </div>
                  <div className="mb-8 flex items-center gap-4 lg:flex-col lg:items-start">
                    <div className="hidden h-px flex-1 bg-transparent lg:block" />
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-[1.4rem] border text-black shadow-[0_12px_28px_rgba(16,24,40,0.08)] ${
                        index === 1
                          ? 'border-[#6c4fe0]/18 bg-[#f4f1ff]'
                          : 'border-black/8 bg-[#fcfde8]'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <span className="hidden text-xs uppercase tracking-[0.26em] text-black/35 lg:inline">
                      {index === 0 ? 'Set direction' : index === 1 ? 'Shift into motion' : 'Close the loop'}
                    </span>
                  </div>
                  <h3
                    className="mb-4 max-w-[14ch] text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#101828] md:text-[2rem]"
                    style={{ fontFamily: 'Figtree, sans-serif' }}
                  >
                    {step.title}
                  </h3>
                  <p className="max-w-[34ch] leading-7 text-[#4a5565]">{step.description}</p>
                  {index < steps.length - 1 ? (
                    <div className="mt-8 flex items-center gap-3 text-xs uppercase tracking-[0.26em] text-black/35 lg:mt-10">
                      <span>{index === 0 ? 'Then' : 'Next'}</span>
                      <span className="h-px flex-1 bg-black/12" />
                    </div>
                  ) : (
                    <div className="mt-8 text-xs uppercase tracking-[0.26em] text-black/35 lg:mt-10">Ready for review</div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
