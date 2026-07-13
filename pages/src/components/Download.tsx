const logoSrc = `${import.meta.env.BASE_URL}illustrations/logo.svg`

const Download = () => {
  return (
    <section id="download" className="bg-[#fbfaf8] py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem] border-t border-black/8 pt-14 md:pt-16">
          <div className="mx-auto max-w-[48rem] text-center">
            <div className="flex flex-wrap items-center justify-center gap-3 text-[clamp(2.85rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              <h2>Download</h2>
              <img src={logoSrc} alt="Omvra" className="h-12 w-auto md:h-14" />
            </div>

            <p className="mx-auto mt-8 max-w-[31rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              Get a local workspace for planning and shipping work with AI agents.
              <br />
              Free to download, open source, local-first, and ready to use without an account.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="https://github.com/lorddarq/omvra/releases/latest"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#3b3b43] px-8 py-4 text-lg font-semibold text-white shadow-[0_8px_20px_rgba(59,59,67,0.18)] transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-[#303038] hover:shadow-[0_12px_24px_rgba(59,59,67,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfaf8]"
              >
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.2}
                    d="M12 4v11m0 0l-4-4m4 4l4-4M4 18v1a2 2 0 002 2h12a2 2 0 002-2v-1"
                  />
                </svg>
                Download Omvra
              </a>

              <a
                href="https://github.com/lorddarq/omvra"
                className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-white/70 px-8 py-4 text-lg font-medium text-[#54515f] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] backdrop-blur transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/10 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfaf8]"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.66.5 12.03c0 5.1 3.3 9.42 7.88 10.95.58.1.79-.25.79-.56 0-.28-.01-1.2-.02-2.18-3.21.7-3.89-1.36-3.89-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.69 1.26 3.35.97.1-.75.4-1.26.72-1.55-2.56-.29-5.25-1.29-5.25-5.72 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.19 1.18a11.05 11.05 0 015.8 0c2.22-1.49 3.19-1.18 3.19-1.18.63 1.6.23 2.78.11 3.07.74.8 1.19 1.83 1.19 3.09 0 4.45-2.69 5.42-5.26 5.71.41.35.77 1.04.77 2.11 0 1.53-.01 2.76-.01 3.13 0 .31.21.67.8.56A11.54 11.54 0 0023.5 12.03C23.5 5.66 18.35.5 12 .5Z" />
                </svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Download
