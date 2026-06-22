const Download = () => {
  const trustPoints = ['Open source', 'Local-first', 'No account required', 'Cross-platform']

  return (
    <section id="download" className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-5xl border-t border-black/10 pt-10 md:pt-12">
          <div className="grid gap-10 text-center md:grid-cols-[minmax(0,1.1fr)_auto] md:items-end md:gap-12 md:text-left">
            <div className="max-w-3xl">
              <h2 className="mb-6 text-4xl font-normal tracking-[-0.03em] text-black md:text-5xl">
                Download Omvra
              </h2>
              <p className="text-lg font-normal leading-8 text-[#6B6B6B] md:text-xl">
                Get a calmer way to plan and ship work. Omvra is free to download, open source,
                local-first, and ready to use without creating an account.
              </p>
            </div>

            <div className="flex flex-col items-center gap-5 md:items-end">
              <a
                href="https://github.com/lorddarq/omvra/releases/latest"
                className="inline-flex items-center gap-3 rounded-xl border border-black/10 bg-[#FFCA15] px-8 py-4 text-lg font-medium text-black shadow-[0_4px_12px_rgba(136,105,0,0.3),0_2px_4px_rgba(121,94,0,0.2)] transition-[transform,background-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:bg-[#FFD84A] hover:shadow-[0_10px_24px_rgba(136,105,0,0.28)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B0C81A] focus-visible:ring-offset-2"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download Latest Release
              </a>

              <a
                href="https://github.com/lorddarq/omvra"
                className="text-base font-normal text-[#6C4FE0] underline decoration-[#D5CEF1] underline-offset-4 transition-colors hover:text-[#34217F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D5CEF1] focus-visible:ring-offset-2"
              >
                View source, releases, and project updates on GitHub
              </a>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-medium text-black/78 md:justify-start">
            {trustPoints.map((point, index) => (
              <span key={point}>
                {point}
                {index < trustPoints.length - 1 ? (
                  <span aria-hidden="true" className="ml-5 text-black/25">
                    /
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Download
