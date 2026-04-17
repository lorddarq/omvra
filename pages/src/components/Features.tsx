const Features = () => {
  const features = [
    {
      title: 'Plan on a timeline, then execute in Kanban',
      description:
        'Start with visual scheduling, switch to execution when the work is moving, and keep the same tasks connected across both views.',
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      ),
    },
    {
      title: 'See schedules clearly',
      description:
        'Use drag-and-drop timeline planning, swimlanes, and date resizing to spot collisions early and keep delivery dates realistic.',
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      title: 'Keep work moving',
      description:
        'Organize tasks in flexible status columns, search quickly, and use richer card previews so handoffs and prioritization take less effort.',
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 4H5a2 2 0 00-2 2v14a2 2 0 002 2h4M9 4h6M9 4v16M15 4h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M15 4v16"
          />
        </svg>
      ),
    },
    {
      title: 'Coordinate across projects',
      description:
        'Assign work to multiple projects while keeping one primary scheduling context, so cross-team tasks stay visible without duplication.',
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
          />
        </svg>
      ),
    },
    {
      title: 'Keep context with the task',
      description:
        'Store markdown notes, structured comments, and task details in one place so the next person has the full picture without digging through other tools.',
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
          />
        </svg>
      ),
    },
    {
      title: 'Spot workload before it becomes overload',
      description:
        'Track person-level load with separate execution and pipeline metrics so you can rebalance work before it starts blocking delivery.',
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      title: 'Back up everything when you want',
      description:
        'Export and import full workspace backups, inspect storage usage, and manage local settings without handing your planning data to a hosted service.',
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.757.426 1.757 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.757-2.924 1.757-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.757-.426-1.757-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.607 2.296.07 2.572-1.065z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      title: 'Bring AI in with guardrails',
      description:
        'When you want AI help, Plumy exposes structured MCP workflows so assistants can inspect context, leave concise updates, and hand work back for human review.',
      icon: (
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7.5 12h9m-9 0a3 3 0 110-6h9a3 3 0 010 6m-9 0a3 3 0 100 6h9a3 3 0 100-6"
          />
        </svg>
      ),
    },
  ]

  return (
    <section id="features" className="bg-white py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-3xl text-center md:mb-20">
            <h2
              className="mb-6 text-4xl font-medium leading-[1.08] tracking-[-0.03em] text-[#101828] md:text-5xl"
              style={{ fontFamily: 'Figtree, sans-serif' }}
            >
              What you can do in Plumy
            </h2>
            <p className="text-lg leading-8 text-[#4a5565] md:text-xl">
              Every part of the product is aimed at the same outcome: clearer planning, smoother execution, and less
              work lost between tools.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className="group rounded-[28px] border border-[#ebebeb] bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#d5cef1] hover:shadow-[0_18px_45px_rgba(108,79,224,0.10)] focus-within:-translate-y-1.5 focus-within:border-[#d5cef1] focus-within:shadow-[0_18px_45px_rgba(108,79,224,0.10)] md:p-8"
              >
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#6c4fe0]/15 bg-[#6c4fe0]/8 text-[#6c4fe0] shadow-[0_8px_24px_rgba(108,79,224,0.12)] transition-transform duration-300 group-hover:scale-105 group-focus-within:scale-105">
                    {feature.icon}
                  </div>
                  <span className="text-sm font-semibold tracking-[0.18em] text-[#99a1af]">0{index + 1}</span>
                </div>
                <h3
                  className="mb-3 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#101828]"
                  style={{ fontFamily: 'Figtree, sans-serif' }}
                >
                  {feature.title}
                </h3>
                <p className="leading-7 text-[#4a5565]">{feature.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-16 rounded-[32px] border border-[#d5cef1] bg-[linear-gradient(180deg,rgba(108,79,224,0.06)_0%,rgba(108,79,224,0.02)_100%)] p-8 shadow-[0_24px_60px_rgba(108,79,224,0.08)] md:mt-24 md:p-12">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center rounded-full border border-[#6c4fe0]/25 bg-white/80 px-4 py-1.5 text-sm font-medium text-[#6c4fe0]">
                MCP Support
              </div>
              <h3
                className="mb-6 text-3xl font-medium leading-tight tracking-[-0.03em] text-[#101828] md:text-4xl"
                style={{ fontFamily: 'Figtree, sans-serif' }}
              >
                AI workflows when you want them, not when you do not
              </h3>
              <div className="space-y-5 text-base leading-8 text-[#4a5565] md:text-lg">
                <p>
                  Plumy includes Model Context Protocol support for teams that want structured AI help without giving
                  up human control. Instead of relying on brittle copy-paste, assistants can read typed task context
                  and follow safer handoff workflows.
                </p>
                <p>
                  That means agents can inspect assigned work, leave concise completion notes, and move tasks into
                  human review with clearer guardrails than ad hoc prompting alone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Features
