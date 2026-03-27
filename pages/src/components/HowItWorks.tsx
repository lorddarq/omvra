const steps = [
  {
    number: '01',
    title: 'Plan the work',
    description:
      'Lay out tasks on a visual timeline, group them by project or swimlane, and see what is happening next without building a heavyweight process around it.',
  },
  {
    number: '02',
    title: 'Move it through execution',
    description:
      'Switch to Kanban when it is time to ship, reorder priorities quickly, and keep ownership, notes, and status changes tied to the same task.',
  },
  {
    number: '03',
    title: 'Review and hand off cleanly',
    description:
      'Use comments, markdown details, and optional MCP-powered agent workflows to keep handoffs concise, visible, and easy for humans to review.',
  },
]

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="bg-nordic-gray-50 py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <p className="mb-4 text-sm font-light uppercase tracking-[0.2em] text-nordic-blue">How It Works</p>
            <h2 className="mb-6 text-5xl font-light text-nordic-gray-800">A simple flow from planning to delivery</h2>
            <p className="text-xl font-light leading-relaxed text-nordic-gray-600">
              Plumy is designed to be easy to understand on day one. You plan visually, execute in the same workspace,
              and keep handoffs clean without adding another cloud service to manage.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="rounded-2xl border border-nordic-gray-200 bg-white p-8 shadow-sm">
                <p className="mb-6 text-sm font-light uppercase tracking-[0.2em] text-nordic-blue">{step.number}</p>
                <h3 className="mb-4 text-2xl font-light text-nordic-gray-800">{step.title}</h3>
                <p className="font-light leading-relaxed text-nordic-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
