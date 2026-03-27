const Download = () => {
  const trustPoints = ['Open source on GitHub', 'No account required', 'No hidden telemetry', 'Available for macOS, Windows, and Linux']

  return (
    <section id="download" className="py-32 bg-nordic-gray-50">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-light text-nordic-gray-800 mb-6">
            Download Plumy
          </h2>
          <p className="text-xl text-nordic-gray-600 font-light mb-12 max-w-2xl mx-auto">
            Get a calmer way to plan and ship work. Plumy is free to download, open source, local-first, and ready to use without creating an account.
          </p>

          <div className="flex flex-col items-center gap-6">
            <a
              href="https://github.com/lorddarq/Plumy/releases/latest"
              className="inline-flex items-center gap-3 rounded-xl bg-[linear-gradient(148deg,#323232_-9.84%,#151515_97.2%)] px-8 py-4 text-lg font-medium text-white shadow-lg shadow-black/30 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Latest Release
            </a>

            <a
              href="https://github.com/lorddarq/Plumy"
              className="text-base font-light text-nordic-gray-700 underline decoration-nordic-gray-300 underline-offset-4 transition-colors hover:text-nordic-gray-900"
            >
              View source, releases, and project updates on GitHub
            </a>

            <div className="mt-2 grid w-full max-w-3xl gap-4 md:grid-cols-2">
              {trustPoints.map((point) => (
                <div key={point} className="rounded-xl border border-nordic-gray-200 bg-white px-5 py-4 text-sm font-light text-nordic-gray-700 shadow-sm">
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
