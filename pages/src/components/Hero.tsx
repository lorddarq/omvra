import {
  Download,
  GripVertical,
  Pencil,
  Plus,
  Settings2,
  Users,
} from 'lucide-react'

const trustPills = ['Open source', 'Local-first', 'No account required', 'Cross-platform']

const navLinks = [
  { href: '#why-plumy', label: 'Why Plumy' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#download', label: 'Download' },
]

const swimlanes = [
  { name: 'Plumy Web', accent: '#0082F6', tint: 'rgba(0,130,246,0.10)' },
  { name: 'Work project', accent: '#F65200', tint: 'rgba(246,82,0,0.10)' },
  { name: 'Plumy', accent: '#00CCB7', tint: 'rgba(0,204,183,0.10)' },
]

const days = Array.from({ length: 14 }, (_, index) => index + 1)

const laneTasks = [
  {
    lane: 'Plumy Web',
    start: 7,
    span: 3,
    title: 'Landing page polish',
    color: '#923BF6',
    dot: 'rgba(43,127,255,0.90)',
  },
  {
    lane: 'Work project',
    start: 5,
    span: 4,
    title: 'Client review handoff',
    color: '#6EAE59',
    dot: 'rgba(255,43,43,0.90)',
  },
  {
    lane: 'Plumy',
    start: 1,
    span: 4,
    title: 'Timeline layout pass',
    color: '#3B82F6',
    dot: 'rgba(255,213,43,0.90)',
  },
]

const logoMark = (
  <svg
    aria-hidden="true"
    className="h-auto w-[13rem] sm:w-[15rem]"
    viewBox="0 0 241 27"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M187.815 6.1109C194.201 6.41252 198.504 6.65145 202.088 6.8563C207.265 7.07529 212.454 7.30237 217.602 7.54306C224.46 7.87549 231.253 8.16978 238.109 8.71393C238.982 8.79556 239.816 8.85114 240.832 9.03522C240.911 9.05117 241.022 9.07601 241.124 9.10457C241.177 9.11933 241.234 9.13593 241.297 9.15799C241.323 9.17511 241.51 9.19983 241.863 9.46014C242.034 9.6009 242.343 9.8529 242.492 10.4385C242.662 11.0276 242.34 11.7598 242.087 11.9917C241.83 12.264 241.651 12.3404 241.521 12.4071C241.389 12.4687 241.293 12.4978 241.275 12.5039C241.133 12.5489 241.029 12.5703 240.924 12.5904C240.698 12.6308 240.641 12.6353 240.488 12.6536C240.34 12.6702 240.234 12.6792 240.122 12.6886C240.009 12.6979 239.89 12.7065 239.762 12.715C239.649 12.7225 239.552 12.729 239.44 12.7353C239.22 12.7476 238.975 12.7589 238.776 12.7671C237.028 12.837 235.308 12.8576 233.594 12.874C230.187 12.9022 226.772 12.8919 223.339 12.8725C221.777 12.8632 220.174 12.8508 218.592 12.8369C212.195 12.78 205.795 12.7017 199.397 12.6339C193.516 12.5711 187.619 12.5126 181.735 12.468C178.306 12.4844 175.047 12.5144 172.026 12.5458C167.78 12.5899 163.998 12.6368 160.879 12.6465C154.194 12.6659 146.721 12.6066 140.702 12.616C139.934 12.6171 139.198 12.6189 138.499 12.6222C137.489 12.6267 136.482 12.6353 135.588 12.6447C130.593 12.7765 125.537 12.9801 120.57 13.2785C120.228 13.2772 119.886 13.2754 119.542 13.274C115.269 13.2715 110.018 13.5585 101.809 14.538C98.2548 14.9811 94.1321 15.5548 89.3661 16.5638C87.8535 16.8871 86.6822 17.1499 85.7574 17.3498C85.4412 17.4179 85.1537 17.486 84.8924 17.5518C85.1845 17.5939 85.4921 17.6305 85.8017 17.6606C87.7727 17.8504 90.2261 17.9316 93.466 18.2487C103.82 19.1907 108.421 18.9905 111.917 18.9229C112.751 18.901 113.523 18.8793 114.325 18.8718C114.482 18.87 114.641 18.8695 114.801 18.869C117.868 18.8603 122.23 19.0462 125.534 19.2323C128.161 19.3816 133.392 19.3804 137.372 19.3199C138.874 19.2974 140.896 19.3263 143.307 19.3581C145.764 19.3905 148.657 19.4261 151.711 19.4093C159.473 19.3664 163.587 19.3346 166.892 19.3105C167.837 19.3033 168.726 19.2963 169.596 19.2888C172.371 19.2653 175.827 19.2513 179.304 19.2323C183.471 19.21 187.722 19.1808 190.934 19.1302C199.298 19.2112 207.645 19.2847 215.995 19.3351C220.291 19.3615 224.399 19.564 227.44 19.9121C230.472 20.2606 232.184 20.7252 232.187 21.2194C232.19 21.7131 230.483 22.2016 227.455 22.5842C224.416 22.9666 220.306 23.2079 216.006 23.2602C207.359 23.3649 198.708 23.4452 190.052 23.4857C179.513 23.5349 168.972 23.5261 158.434 23.4248C151.071 23.3538 143.676 23.2513 136.322 23.114C135.553 23.0996 134.792 23.0847 134.039 23.0698C127.839 23.0895 121.652 23.0739 117.295 23.0072C116.203 22.9909 115.132 22.9639 114.218 22.9345C112.081 22.8662 110.396 22.7755 108.824 22.6891C107.304 22.6042 105.923 22.5245 104.526 22.4804C103.805 22.4577 102.766 22.427 101.539 22.3871C96.8233 22.0142 90.1794 22.7225 81.721 20.2931C81.4381 20.1389 81.1225 19.9748 80.7021 19.5569C80.4873 19.3319 80.2409 19.0382 80.0522 18.5385C79.8593 18.0486 79.84 17.3685 79.994 16.8811C80.3247 15.8938 80.7707 15.6118 81.0623 15.3478C81.3705 15.1039 81.6248 14.9596 81.8637 14.8322C82.9615 14.2776 83.872 14.0481 84.8436 13.8059C87.5744 13.1526 90.5813 12.5996 93.463 12.1804C98.9322 11.38 104.023 10.9842 106.593 10.6887C111.092 10.1714 116.284 9.86795 120.861 9.68712C121.009 9.68118 121.156 9.67579 121.303 9.67008C121.198 9.66844 121.095 9.66686 120.992 9.66542C118.693 9.633 115.406 9.49674 112.121 9.36419C109.823 9.27151 107.534 9.18032 105.559 9.12487C103.643 9.07085 101.606 9.07432 99.6714 9.079C97.3333 9.08431 95.0889 9.09099 93.1746 9.00086C92.7858 8.98255 92.3047 8.90028 91.7045 8.79739C91.279 8.72445 90.7902 8.64098 90.2367 8.56275C87.7907 8.52703 85.3973 8.49193 82.9337 8.45555C82.8478 8.46467 82.7591 8.47376 82.6705 8.48325L82.6666 8.48405C80.6853 8.69864 77.9534 8.99192 74.0928 8.76167C73.3674 8.71811 72.8488 8.65315 72.4074 8.587C72.2513 8.56447 72.1041 8.54184 71.9616 8.51979C71.4108 8.4345 70.9211 8.35884 70.212 8.33843C69.4035 8.3153 68.479 8.35818 67.4145 8.40588C65.9447 8.47302 64.3361 8.55037 62.6877 8.46601C62.5767 8.46027 62.4575 8.45403 62.3337 8.44774C61.1879 8.38794 59.3657 8.30027 57.6623 8.13296C52.4628 8.0873 47.2937 8.05943 42.1193 8.0676C33.4823 8.08242 24.868 8.19482 16.26 8.54356C12.0734 8.7106 8.05483 8.75722 5.05913 8.60961C2.0721 8.46138 0.366289 8.12156 0.331146 7.63747C0.295273 7.15485 1.92715 6.56027 4.86804 5.98072C7.81786 5.40146 11.8367 4.89901 16.0525 4.62367C22.9257 4.17261 29.8042 3.87105 36.6866 3.6633C37.0526 3.64641 37.4187 3.6307 37.7708 3.61546C40.4757 3.50078 42.9097 3.33346 45.4309 3.17314C45.9913 3.13653 46.56 3.10031 47.1373 3.06526C51.5327 2.79246 59.9109 2.88141 64.5616 2.95895C64.6476 2.96018 64.7359 2.96111 64.8205 2.96234C65.8973 2.97957 66.9327 2.98868 68.1697 2.99991C69.3571 3.0108 70.6726 3.02337 72.4537 3.05159C74.9381 3.09196 78.3383 3.1634 83.1634 3.31126C85.5796 3.33601 87.9171 3.36506 90.3118 3.40003C116.012 3.78355 141.695 4.57003 167.377 5.49626C167.7 5.50387 168.029 5.51144 168.36 5.51926C174.801 5.67095 182.805 5.87345 187.815 6.1109Z"
      fill="#6C4FE0"
    />
  </svg>
)

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(108,79,224,0.07),transparent_42%)]"
      />

      <nav className="landing-container relative z-10 py-8">
        <div className="flex items-center justify-between gap-8">
          <a href="#" className="text-2xl font-bold lowercase tracking-tight text-plumy-ink">
            plumy
          </a>
          <div className="hidden items-center gap-10 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-normal text-plumy-ink transition-colors duration-150 hover:text-plumy-lilac focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plumy-lilac/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      <div className="landing-container relative z-10 pb-24 pt-14 sm:pb-28 sm:pt-20">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <div className="landing-eyebrow border-plumy-gold/10 bg-plumy-gold-soft text-plumy-gold-ink">
            Free to download. Available for macOS, Windows, and Linux.
          </div>
          <div className="mt-8 flex max-w-4xl flex-col items-center gap-3">
            {logoMark}
            <h1 className="max-w-4xl text-balance text-[clamp(3.4rem,8vw,4.5rem)] font-normal leading-[0.92] tracking-[-0.045em] text-plumy-ink">
              Plan work visually.
              <br />
              Keep it local.
            </h1>
          </div>
          <p className="mt-7 max-w-3xl text-pretty text-lg leading-8 text-plumy-muted sm:text-xl">
            Plumy is an open-source desktop planner for teams that want clear timelines, fast
            Kanban execution, and helpful AI workflows without accounts, hidden telemetry, or
            extra process.
          </p>

          <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row">
            <a
              href="#download"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-xl border border-black/10 bg-plumy-gold px-8 py-4 text-lg font-medium text-plumy-ink shadow-[0_4px_12px_rgba(136,105,0,0.30),0_2px_4px_rgba(121,94,0,0.20)] transition-[transform,background-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#f3c317] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plumy-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              <Download className="size-5" strokeWidth={2.2} />
              Download Plumy
            </a>
            <a
              href="https://github.com/lorddarq/Plumy"
              className="inline-flex min-h-14 items-center justify-center rounded-xl bg-plumy-lilac-soft px-8 py-4 text-lg font-normal text-plumy-lilac transition-[background-color,transform] duration-150 ease-out hover:bg-[rgba(108,79,224,0.18)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plumy-lilac/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              View on GitHub
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {trustPills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-black/20 px-4 py-2 text-sm font-medium text-plumy-ink"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-24 max-w-[70rem] px-0 sm:px-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-x-6 top-8 h-48 rounded-full bg-[rgba(232,208,112,0.25)] blur-[120px] sm:inset-x-10 sm:h-64 sm:blur-[160px]" />
            <div className="relative overflow-hidden rounded-xl border border-[#dbdbdb] bg-[#fdfdfd] shadow-[0_10px_13px_rgba(0,0,0,0.05),0_3px_4px_rgba(0,0,0,0.10)]">
              <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3 sm:px-6">
                <div className="rounded-md bg-plumy-soft-2 p-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="rounded-[4px] bg-white px-4 py-1.5 text-sm font-medium text-[#101828] shadow-[0_1px_3px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.10)]"
                    >
                      Timeline
                    </button>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="rounded-[4px] px-4 py-1.5 text-sm font-medium text-[#4a5565]"
                    >
                      Kanban
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Settings"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="inline-flex size-9 items-center justify-center rounded-md"
                  >
                    <Settings2 className="size-4 text-plumy-ink" strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    aria-label="People"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="inline-flex size-9 items-center justify-center rounded-md"
                  >
                    <Users className="size-4 text-plumy-ink" strokeWidth={1.8} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 border-b border-black/5 bg-plumy-soft px-4 py-3 sm:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-1 text-sm font-medium text-plumy-ink">Timeline</span>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="inline-flex size-5 items-center justify-center rounded-md text-base font-medium text-plumy-ink"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="inline-flex items-center rounded-md border border-black/10 bg-white px-3 py-0.5 text-sm font-medium text-plumy-ink"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="inline-flex size-5 items-center justify-center rounded-md text-base font-medium text-plumy-ink"
                  >
                    ▶
                  </button>
                  <span className="rounded-md bg-plumy-soft-2 px-3 py-0.5 text-sm font-medium text-[#364153]">
                    7 days
                  </span>
                </div>

                <div className="hidden rounded-md bg-plumy-soft-2 p-1 sm:flex">
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="rounded-[4px] bg-white px-3 py-1 text-sm font-medium text-[#101828] shadow-[0_1px_3px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.10)]"
                  >
                    Projects
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    className="rounded-[4px] px-3 py-1 text-sm font-medium text-[#4a5565]"
                  >
                    People
                  </button>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row">
                <div className="w-full border-b border-black/10 lg:w-[16.5rem] lg:border-b-0 lg:border-r">
                  <div className="relative flex items-start justify-between bg-plumy-soft px-3 pb-10 pt-3">
                    <span className="text-sm font-medium text-plumy-ink">Swimlanes</span>
                    <button
                      type="button"
                      aria-label="Add swimlane"
                      tabIndex={-1}
                      aria-hidden="true"
                      className="inline-flex size-8 items-center justify-center rounded-md text-[#4b5563]"
                    >
                      <Plus className="size-4" strokeWidth={2.2} />
                    </button>
                    <div className="absolute bottom-0 right-0 top-0 flex w-[7px] items-center justify-center bg-[#e5e7eb]">
                      <div className="flex h-3 gap-px">
                        <span className="h-full w-px rounded-full bg-[#abb2bf]" />
                        <span className="h-full w-px rounded-full bg-[#abb2bf]" />
                        <span className="h-full w-px rounded-full bg-[#abb2bf]" />
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-black/5 bg-white">
                    {swimlanes.map((lane) => (
                      <div
                        key={lane.name}
                        className="flex items-center gap-2 border-l-4 px-4 py-3"
                        style={{ borderLeftColor: lane.accent }}
                      >
                        <GripVertical className="size-3.5 text-[#99a1af]" />
                        <span className="flex-1 text-left text-sm text-[#364153]">{lane.name}</span>
                        <button
                          type="button"
                          aria-label={`Edit ${lane.name}`}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="inline-flex size-6 items-center justify-center rounded-md text-[#929292]"
                        >
                          <Pencil className="size-3" strokeWidth={1.8} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="min-w-0 flex-1 overflow-x-auto">
                  <div className="min-w-[52rem]">
                    <div className="border-b border-[#e7e7e7] bg-white px-3 py-2 text-sm font-medium text-plumy-ink">
                      Mar 2026
                    </div>
                    <div className="flex border-b border-[#e7e7e7] bg-white px-1 py-2">
                      {days.map((day) => (
                        <div key={day} className="flex min-w-[58px] flex-1 items-center justify-center">
                          <span
                            className={
                              day === 10
                                ? 'inline-flex size-8 items-center justify-center rounded-full border border-[#3b82f6] text-center text-xs text-[rgba(43,127,255,0.90)]'
                                : 'text-xs text-plumy-ink'
                            }
                          >
                            {day}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col">
                      {swimlanes.map((lane) => (
                        <div
                          key={lane.name}
                          className="relative flex h-12 items-center border-b border-[#e7e7e7]"
                          style={{ backgroundColor: lane.tint }}
                        >
                          <div className="absolute inset-0 flex">
                            {days.map((day) => (
                              <div
                                key={`${lane.name}-${day}`}
                                className="min-w-[58px] flex-1 border-r border-black/10 last:border-r-0"
                              />
                            ))}
                          </div>
                          {laneTasks
                            .filter((task) => task.lane === lane.name)
                            .map((task) => (
                              <div
                                key={task.title}
                                className="relative z-10 flex h-8 items-center gap-2 rounded-md border border-black/25 px-2 text-xs font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.10)]"
                                style={{
                                  backgroundColor: task.color,
                                  width: `calc(${task.span} * (100% / ${days.length}) - 16px)`,
                                  marginLeft: `calc(${task.start - 1} * (100% / ${days.length}) + 8px)`,
                                }}
                              >
                                <span className="h-3 w-3 shrink-0 rounded-full border-2 border-white/25" style={{ backgroundColor: task.dot }} />
                                <span className="truncate">{task.title}</span>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Hero
