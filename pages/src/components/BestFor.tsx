const BestFor = () => {
  const groups = [
    {
      title: 'Product and engineering leads',
      description:
        'Useful when you need one place to see schedules, execution status, ownership, and review flow without adopting a heavyweight project suite.',
    },
    {
      title: 'Client-facing and operations teams',
      description:
        'Helpful for teams managing several streams of work at once, especially when priorities shift often and handoffs need to stay visible.',
    },
    {
      title: 'Teams replacing spreadsheet-plus-chat workflows',
      description:
        'A strong fit if you have outgrown ad hoc planning but still want something simpler, calmer, and easier to trust than a cloud-heavy stack.',
    },
  ]

  return (
    <section id="best-for" className="py-28 bg-nordic-gray-50">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl font-light text-nordic-gray-800 mb-6 text-center">
            Built for teams that want less overhead
          </h2>
          <p className="text-xl text-nordic-gray-600 font-light mb-16 text-center max-w-3xl mx-auto">
            Plumy is especially strong for teams that need better planning clarity but do not want another bloated system to administer.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            {groups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-nordic-gray-200 bg-white p-7">
                <h3 className="text-2xl font-light text-nordic-gray-800 mb-3">{group.title}</h3>
                <p className="text-nordic-gray-600 font-light leading-relaxed">{group.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default BestFor
