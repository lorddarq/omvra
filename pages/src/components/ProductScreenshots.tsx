import { useState } from 'react'

const screenshots = [
  {
    label: 'Timeline planning',
    title: 'See when work happens.',
    description: 'Lay out projects across time, spot collisions, and keep the next move visible.',
    src: `${import.meta.env.BASE_URL}screens/timeline.png`,
  },
  {
    label: 'Kanban execution',
    title: 'Keep work moving.',
    description: 'Make ownership and status visible while tasks move toward review and completion.',
    src: `${import.meta.env.BASE_URL}screens/kanban.png`,
  },
  {
    label: 'Roadmap coordination',
    title: 'Connect milestones to delivery.',
    description: 'See the work behind each milestone and the dependencies that can slow it down.',
    src: `${import.meta.env.BASE_URL}screens/roadmap.png`,
  },
] as const

function Arrow({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
      <path
        d={direction === 'previous' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const ProductScreenshots = () => {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeScreenshot = screenshots[activeIndex]

  const move = (offset: number) => {
    setActiveIndex((current) => (current + offset + screenshots.length) % screenshots.length)
  }

  return (
    <section id="screenshots" className="bg-white py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance text-[clamp(2.7rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              See Omvra in action
            </h2>
            <p className="mx-auto mt-7 max-w-[42rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              One workspace, different views for planning, execution, and delivery.
            </p>
          </div>

          <div className="mt-16">
            <div>
              <img
                key={activeScreenshot.src}
                src={activeScreenshot.src}
                alt={`${activeScreenshot.label} view in Omvra`}
                className="block h-auto w-full motion-safe:animate-[product-screen-in_220ms_ease-out]"
              />
            </div>

            <div className="flex flex-col gap-6 px-2 pb-1 pt-6 sm:flex-row sm:items-end sm:justify-between sm:px-1 sm:pt-7">
              <div className="max-w-[31rem]">
                <p className="text-sm font-semibold text-[#7a7680]">{activeScreenshot.label}</p>
                <h3 className="mt-2 text-[2rem] font-medium leading-[1.08] tracking-[-0.05em] text-[#5b5966]">
                  {activeScreenshot.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-[#77737c]">{activeScreenshot.description}</p>
              </div>

              <div className="flex items-center justify-between gap-5 sm:shrink-0">
                <div className="flex items-center gap-2" aria-label="Choose product view">
                  {screenshots.map((screenshot, index) => (
                    <button
                      key={screenshot.label}
                      type="button"
                      aria-label={`Show ${screenshot.label}`}
                      aria-pressed={activeIndex === index}
                      onClick={() => setActiveIndex(index)}
                      className={`h-2 rounded-full transition-[width,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5966]/30 focus-visible:ring-offset-4 ${
                        activeIndex === index ? 'w-8 bg-[#5b5966]' : 'w-2 bg-[#d0ccd0] hover:bg-[#aaa5ad]'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Show previous product view"
                    onClick={() => move(-1)}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-black/10 bg-white text-[#5b5966] transition-colors hover:bg-[#f4f2ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5966]/30 focus-visible:ring-offset-2"
                  >
                    <Arrow direction="previous" />
                  </button>
                  <button
                    type="button"
                    aria-label="Show next product view"
                    onClick={() => move(1)}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-black/10 bg-white text-[#5b5966] transition-colors hover:bg-[#f4f2ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5966]/30 focus-visible:ring-offset-2"
                  >
                    <Arrow direction="next" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ProductScreenshots
