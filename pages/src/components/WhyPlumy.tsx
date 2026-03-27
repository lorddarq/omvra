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
    <section id="why-plumy" className="bg-white py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="mb-4 text-sm font-light uppercase tracking-[0.2em] text-nordic-blue">Why Plumy</p>
            <h2 className="mb-6 text-5xl font-light text-nordic-gray-800">Why teams switch to Plumy</h2>
            <p className="text-xl font-light leading-relaxed text-nordic-gray-600">
              Plumy is for teams that want clear planning, fast execution, and less overhead. It gives you the
              visibility of a timeline, the momentum of Kanban, and the control of a local-first desktop app.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {reasons.map((reason) => (
              <div
                key={reason.title}
                className="rounded-2xl border border-nordic-gray-200 bg-nordic-gray-50 p-8 shadow-sm"
              >
                <h3 className="mb-4 text-2xl font-light text-nordic-gray-800">{reason.title}</h3>
                <p className="font-light leading-relaxed text-nordic-gray-600">{reason.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhyPlumy
