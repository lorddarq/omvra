const Download = () => {
  return (
    <section id="download" className="py-32 bg-nordic-gray-50">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-light text-nordic-gray-800 mb-6">
            Download for free
          </h2>
          <p className="text-xl text-nordic-gray-600 font-light mb-12 max-w-2xl mx-auto">
            Get Plumy now and start organizing your projects. Free forever, no account required.
          </p>

          <div className="flex flex-col items-center gap-6">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-nordic-gray-200 bg-white px-4 py-3 shadow-sm">
              <img
                src="/plumy-icon-72.png"
                alt="Plumy app icon"
                className="h-[72px] w-[72px] rounded-2xl shadow-sm ring-1 ring-black/5"
              />
              <div className="text-left">
                <div className="text-sm font-medium text-nordic-gray-800">Look for this icon</div>
                <div className="text-xs text-nordic-gray-500">Plumy desktop app</div>
              </div>
            </div>

            <a 
              href="https://github.com/lorddarq/Plumy/releases/latest" 
              className="inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-slate-900 to-indigo-700 px-8 py-4 text-lg font-medium text-white shadow-lg shadow-indigo-900/20 transition-all hover:from-slate-800 hover:to-indigo-600 hover:shadow-xl hover:shadow-indigo-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Latest Release
            </a>
            
            <p className="text-sm text-nordic-gray-600 font-light">
              Available for macOS, Windows, and Linux
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Download
