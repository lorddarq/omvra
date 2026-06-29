import { Download } from 'lucide-react'

import { Projects } from '../illustrations/heroTimeline'

const navLinks = [
  { href: '#why-omvra', label: 'Why Omvra' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#privacy', label: 'Privacy' },
]

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-[#f8f7f5]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(214,195,170,0.38),transparent_34%),radial-gradient(circle_at_left,rgba(210,204,195,0.24),transparent_42%),linear-gradient(180deg,#f8f7f5_0%,#fbfaf8_50%,#f7f5f2_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[7.5rem] h-[18rem] w-[18rem] -translate-x-1/2 rounded-full border border-[#f0c59d]/70"
      />

      <nav className="landing-container relative z-10 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-6">
          <a href="#" className="inline-flex items-center gap-2.5 text-[1.65rem] font-semibold tracking-[-0.04em] text-[#4e4d5d]">
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-[linear-gradient(180deg,#253565_0%,#ebc39f_100%)] text-[0.8rem] font-semibold text-white">
              o
            </span>
            <span className="text-[1.45rem] font-medium lowercase tracking-[-0.05em] text-[#4f4d59]">
              omvra
            </span>
          </a>

          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[#555461] transition-colors duration-150 hover:text-[#2e2d37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f7f5]"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#download"
              className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[#3b3b43] px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#2f2f36] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f7f5]"
            >
              Download
            </a>
          </div>
        </div>
      </nav>

      <div className="landing-container relative z-10 pb-16 pt-10 sm:pb-20 sm:pt-14 lg:pb-24 lg:pt-16">
        <div className="mx-auto max-w-[52rem] text-center">
          <h1 className="text-balance text-[clamp(3rem,7vw,5rem)] font-medium leading-[0.96] tracking-[-0.06em] text-[#5a5868]">
            Plan visually. Keep local.
            <br />
            <span className="relative inline-block pr-2">
              Delegate to agents.
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-3 right-[-0.6rem] h-[1.55em] w-[1.85em] text-[#f08a2f]"
                viewBox="0 0 118 70"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 36.3C12 21.7 34.8 10 63 10s51 11.7 51 26.3S91.2 62.7 63 62.7 12 50.9 12 36.3Z"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg leading-8 text-[#6d6a73] sm:text-xl">
            Omvra is a human-and-agent interfacing layer for planning and execution, built
            local-first, so neither your data nor your agents need the cloud to get work done.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#download"
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#3b3b43] px-8 py-4 text-lg font-semibold text-white shadow-[0_8px_20px_rgba(59,59,67,0.18)] transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-[#303038] hover:shadow-[0_12px_24px_rgba(59,59,67,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f7f5]"
            >
              <Download className="size-5" strokeWidth={2.2} />
              Download
            </a>
            <a
              href="https://github.com/lorddarq/omvra"
              className="inline-flex min-h-14 items-center justify-center rounded-2xl bg-white/70 px-8 py-4 text-lg font-medium text-[#54515f] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] backdrop-blur transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f8f7f5]"
            >
              View on GitHub
            </a>
          </div>
        </div>

        <div className="relative mx-auto mt-16 h-[260px] max-w-[72rem] sm:h-[360px] md:h-[470px] lg:h-[600px] xl:h-[749px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-10 h-32 rounded-full bg-[rgba(211,193,169,0.22)] blur-[90px] sm:h-44 sm:blur-[110px]"
          />
          <Projects className="absolute left-1/2 top-0 -translate-x-1/2 origin-top scale-[0.18] sm:scale-[0.25] md:scale-[0.33] lg:scale-[0.42] xl:scale-100" />
        </div>
      </div>
    </section>
  )
}

export default Hero
