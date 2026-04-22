const reasons = [
  {
    title: 'See the whole plan without adding more process',
    description:
      'Plan work on a timeline, move it through Kanban, and keep the same tasks in both places so your team spends less time translating status between tools.',
  },
  {
    title: 'Keep ownership, notes, and review handoffs in one place',
    description:
      'Task details, markdown notes, comments, and review-ready handoffs stay attached to the work instead of getting scattered across docs, chats, and spreadsheets.',
  },
  {
    title: 'Stay in control of your data',
    description:
      'Plumy is local-first and open source, with no account required, no hidden telemetry, and full-workspace backups when you want extra peace of mind.',
  },
]

const WhyPlumy = () => {
  return (
    <section id="why-plumy" className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
            <div className="mb-5 inline-flex items-center justify-center rounded-full border border-[#6c4fe0]/25 bg-[#6c4fe0]/6 px-4 py-1.5 text-sm font-medium text-[#6c4fe0]">
              Why Plumy?
            </div>
            <h2
              className="mb-6 text-4xl font-medium leading-[1.08] tracking-[-0.03em] text-[#101828] md:text-5xl"
              style={{ fontFamily: 'Figtree, sans-serif' }}
            >
              Why teams switch to Plumy
            </h2>
            <p className="text-lg leading-8 text-[#4a5565] md:text-xl">
              Plumy is for teams that want clear planning, fast execution, and less overhead. It gives you the
              visibility of a timeline, the momentum of Kanban, and the control of a local-first desktop app.
            </p>
          </div>

          <div className="grid gap-10 md:grid-cols-3 md:gap-8 xl:gap-12">
            {reasons.map((reason, index) => (
              <article key={reason.title} className="relative pt-6">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <span className="text-sm font-semibold tracking-[0.24em] text-[#6c4fe0]">0{index + 1}</span>
                  <span className="text-xs uppercase tracking-[0.24em] text-black/35">
                    {index === 0 ? 'Visibility' : index === 1 ? 'Execution' : 'Control'}
                  </span>
                </div>
                <h3
                  className="mb-4 max-w-[14ch] text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#101828] md:text-[2rem]"
                  style={{ fontFamily: 'Figtree, sans-serif' }}
                >
                  {reason.title}
                </h3>
                <p className="max-w-[34ch] leading-7 text-[#4a5565]">{reason.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhyPlumy
