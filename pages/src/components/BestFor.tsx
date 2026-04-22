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
          <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
            <h2 className="mb-6 text-4xl font-normal tracking-[-0.03em] text-black md:text-5xl">
              Built for teams that want less overhead
            </h2>
            <p className="text-lg font-normal leading-8 text-[#6B6B6B] md:text-xl">
              Plumy is especially strong for teams that need better planning clarity but do not want another bloated
              system to administer.
            </p>
          </div>

          <div className="grid gap-12 md:grid-cols-3 md:gap-8 xl:gap-12">
            {groups.map((group, index) => (
              <article key={group.title} className="border-t border-black/10 pt-6">
                <div className="mb-6 text-sm font-medium tracking-[0.2em] text-black/40">0{index + 1}</div>
                <h3 className="max-w-[16ch] text-xl font-medium leading-8 text-black md:text-2xl">
                  {group.title}
                </h3>
                <p className="max-w-[34ch] pt-6 text-base font-normal leading-7 text-[#6B6B6B]">
                  {group.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default BestFor
