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
          <div className="mx-auto mb-14 max-w-3xl text-center md:mb-16">
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

          <div className="grid gap-6 md:grid-cols-3 xl:gap-8">
            {reasons.map((reason, index) => (
              <article
                key={reason.title}
                className="group relative overflow-hidden rounded-[28px] border border-[#e7e7e7] bg-[#fafafa] p-8 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#d5cef1] hover:bg-white hover:shadow-[0_20px_50px_rgba(108,79,224,0.10)] focus-within:-translate-y-1 focus-within:border-[#d5cef1] focus-within:bg-white focus-within:shadow-[0_20px_50px_rgba(108,79,224,0.10)] md:p-9"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-black/85 transition-opacity duration-300 group-hover:bg-black group-focus-within:bg-black" />
                <div className="mb-7 flex items-center justify-between gap-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[#6c4fe0]/15 bg-white text-sm font-semibold tracking-[0.18em] text-[#6c4fe0] shadow-[0_4px_14px_rgba(108,79,224,0.08)]">
                    0{index + 1}
                  </span>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(108,79,224,0.22),rgba(176,200,26,0.16),transparent)]" />
                </div>
                <h3
                  className="mb-4 text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#101828]"
                  style={{ fontFamily: 'Figtree, sans-serif' }}
                >
                  {reason.title}
                </h3>
                <p className="leading-7 text-[#4a5565]">{reason.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhyPlumy
