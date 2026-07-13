const illustrationBase = `${import.meta.env.BASE_URL}illustrations`

const audiences = [
  {
    title: 'Privacy-sensitive teams',
    description:
      'Keep project context on controlled devices while people and approved AI tools work from the same accountable plan.',
    illustration: 'less-overhead-01.svg',
    widthClassName: 'w-[10.5rem] md:w-[11.6rem]',
  },
  {
    title: 'Technical leads',
    description:
      'Coordinate people and agents across projects, see what is blocked, and send completed work back for review.',
    illustration: 'less-overhead-02.svg',
    widthClassName: 'w-[10.7rem] md:w-[11.7rem]',
  },
  {
    title: 'Independent builders',
    description:
      'Replace scattered notes and agent chats with a free workspace you can inspect, back up, and carry with you.',
    illustration: 'less-overhead-03.svg',
    widthClassName: 'w-[10.3rem] md:w-[11.2rem]',
  },
] as const

const BestFor = () => {
  return (
    <section id="best-for" className="bg-[#fbfaf8] py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance text-[clamp(2.9rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              Built for controlled execution
            </h2>
            <p className="mx-auto mt-7 max-w-[37rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              For teams that want the speed of AI-assisted work without another cloud system holding the context.
            </p>
          </div>

          <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-8">
            {audiences.map((audience) => (
              <article key={audience.title} className="flex flex-col items-center text-center">
                <div className="flex min-h-[12.5rem] items-start justify-center">
                  <img
                    src={`${illustrationBase}/${audience.illustration}`}
                    alt=""
                    className={`h-auto ${audience.widthClassName}`}
                    loading="lazy"
                  />
                </div>
                <h3 className="mt-7 text-[2rem] font-medium leading-[1.08] tracking-[-0.05em] text-[#1f1f24]">
                  {audience.title}
                </h3>
                <p className="mt-6 max-w-[15rem] text-left text-base text-[#77737c] md:max-w-[15.2rem]">
                  {audience.description}
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
