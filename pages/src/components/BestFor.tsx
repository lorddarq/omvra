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
    <section id="best-for" className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-6 text-center text-4xl font-normal tracking-[-0.03em] text-black md:text-5xl">
            Built for teams that want less overhead
          </h2>
          <p className="mx-auto mb-14 max-w-3xl text-center text-lg font-normal leading-8 text-[#6B6B6B] md:mb-16 md:text-xl">
            Plumy is especially strong for teams that need better planning clarity but do not want another bloated system to administer.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {groups.map((group) => (
              <div
                key={group.title}
                className="flex min-h-[16rem] flex-col justify-between rounded-2xl border border-black/10 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <h3 className="max-w-[16ch] text-xl font-medium leading-8 text-black md:text-2xl">
                  {group.title}
                </h3>
                <p className="pt-6 text-base font-normal leading-7 text-[#6B6B6B]">
                  {group.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default BestFor
