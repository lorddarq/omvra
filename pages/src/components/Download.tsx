const Download = () => {
  const trustPoints = ['Open source', 'Local-first', 'No account required', 'Cross-platform']

  return (
    <section id="download" className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-4xl font-normal tracking-[-0.03em] text-black md:text-5xl">
            Download Plumy
          </h2>
          <p className="mx-auto mb-10 max-w-3xl text-lg font-normal leading-8 text-[#6B6B6B] md:mb-12 md:text-xl">
            Get a calmer way to plan and ship work. Plumy is free to download, open source, local-first, and ready to use without creating an account.
          </p>

          <div className="flex flex-col items-center gap-6">
            <a
              href="https://github.com/lorddarq/Plumy/releases/latest"
              className="inline-flex items-center gap-3 rounded-xl border border-black/10 bg-[#FFCA15] px-8 py-4 text-lg font-medium text-black shadow-[0_4px_12px_rgba(136,105,0,0.3),0_2px_4px_rgba(121,94,0,0.2)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FFD84A] hover:shadow-[0_10px_24px_rgba(136,105,0,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B0C81A] focus-visible:ring-offset-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Latest Release
            </a>

            <a
              href="https://github.com/lorddarq/Plumy"
              className="text-base font-normal text-[#6C4FE0] underline decoration-[#D5CEF1] underline-offset-4 transition-colors hover:text-[#34217F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D5CEF1] focus-visible:ring-offset-2"
            >
              View source, releases, and project updates on GitHub
            </a>

            <div className="mt-2 flex max-w-3xl flex-wrap justify-center gap-3">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-full border border-black/20 bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-200 hover:border-black/35 hover:bg-[#FAFAFA]"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Download
