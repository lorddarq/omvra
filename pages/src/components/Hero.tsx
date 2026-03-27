const Hero = () => {
  const trustPills = ['Open source', 'Local-first', 'No account required', 'Cross-platform']

  return (
    <section className="relative overflow-hidden">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-nordic-blue rounded-lg"></div>
            <span className="text-2xl font-light text-nordic-gray-800">Plumy</span>
          </div>
          <div className="hidden md:flex space-x-12">
            <a href="#why-plumy" className="text-sm font-light text-nordic-gray-600 transition-colors hover:text-nordic-gray-800">Why Plumy</a>
            <a href="#features" className="text-sm font-light text-nordic-gray-600 transition-colors hover:text-nordic-gray-800">Features</a>
            <a href="#how-it-works" className="text-sm font-light text-nordic-gray-600 transition-colors hover:text-nordic-gray-800">How it works</a>
            <a href="#privacy" className="text-sm font-light text-nordic-gray-600 transition-colors hover:text-nordic-gray-800">Privacy</a>
            <a href="#download" className="text-sm font-light text-nordic-gray-600 transition-colors hover:text-nordic-gray-800">Download</a>
          </div>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="container mx-auto px-6 pt-24 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <p className="mb-6 text-sm font-light uppercase tracking-[0.25em] text-nordic-blue">
            Local-first project planning for teams
          </p>
          <h1 className="text-6xl md:text-7xl font-light text-nordic-gray-800 mb-8 tracking-tight leading-tight">
            Plan work visually.
            <br />
            <span className="text-nordic-blue">Keep it local.</span>
          </h1>
          <p className="text-xl md:text-2xl text-nordic-gray-600 font-light mb-16 leading-relaxed max-w-2xl mx-auto">
            Plumy is an open-source desktop planner for teams that want clear timelines, fast Kanban execution,
            and helpful AI workflows without accounts, hidden telemetry, or extra process.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#download"
              className="inline-flex items-center gap-3 rounded-xl bg-[linear-gradient(148deg,#323232_-9.84%,#151515_97.2%)] px-8 py-4 text-lg font-medium text-white shadow-lg shadow-black/30 transition-all hover:brightness-110 hover:shadow-xl hover:shadow-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Plumy
            </a>
            <a
              href="https://github.com/lorddarq/Plumy"
              className="inline-flex items-center gap-3 rounded-xl border border-nordic-gray-200 bg-white px-8 py-4 text-lg font-medium text-nordic-gray-800 shadow-sm transition-all hover:border-nordic-gray-300 hover:bg-nordic-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              View on GitHub
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {trustPills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-nordic-gray-200 bg-white/90 px-4 py-2 text-sm font-light text-nordic-gray-700 shadow-sm"
              >
                {pill}
              </span>
            ))}
          </div>
          <p className="mt-6 text-sm font-light text-nordic-gray-500">
            Free to download. Available for macOS, Windows, and Linux.
          </p>
        </div>

        {/* App Screenshot Mockup */}
        <div className="relative mt-24 max-w-6xl mx-auto">
          <div className="pointer-events-none absolute -top-12 -left-10 h-48 w-48 rounded-full bg-indigo-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-6 h-56 w-56 rounded-full bg-cyan-200/40 blur-3xl" />
          <div className="relative overflow-hidden rounded-3xl border border-nordic-gray-200/80 bg-white/95 shadow-2xl shadow-slate-900/10 backdrop-blur">
            {/* App Header */}
            <div className="border-b border-nordic-gray-200 bg-white/90 px-6 py-4 backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-8">
                  <span className="text-lg font-medium tracking-tight">Plumy</span>
                  <div className="flex items-center gap-2 rounded-full bg-nordic-gray-100 p-1">
                    <button className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-nordic-gray-800 shadow-sm">Timeline</button>
                    <button className="rounded-full px-4 py-1.5 text-sm font-light text-nordic-gray-500">Kanban</button>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="w-6 h-6 rounded-full bg-nordic-gray-100 ring-1 ring-nordic-gray-200"></div>
                  <div className="w-6 h-6 rounded-full bg-nordic-gray-800 ring-1 ring-nordic-gray-700"></div>
                </div>
              </div>
            </div>

            {/* Timeline View */}
            <div className="flex">
              {/* Sidebar */}
              <div className="w-48 border-r border-nordic-gray-200 bg-white p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium text-nordic-gray-600 uppercase tracking-wider">Swimlanes</span>
                  <button className="text-nordic-gray-400 hover:text-nordic-gray-600">+</button>
                </div>
                <div className="space-y-2">
                  {['Grazy', 'Inklebot', 'Plumy', 'Website'].map((project) => (
                    <div key={project} className="cursor-pointer rounded-lg px-2 py-1.5 text-sm font-light text-nordic-gray-700 hover:bg-nordic-gray-50">
                      {project}
                    </div>
                  ))}
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="flex-1 overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-6">
                {/* Date Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <button className="text-nordic-gray-600">←</button>
                    <span className="text-sm font-light">Mar 26</span>
                    <button className="text-nordic-gray-600">→</button>
                  </div>
                  <span className="text-xs font-light text-nordic-gray-500">7 days</span>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-4 mb-4 px-2">
                  {[6, 7, 8, 9, 10, 11, 12].map((day) => (
                    <div key={day} className="text-center">
                      <span className="text-xs font-light text-nordic-gray-500">{day}</span>
                    </div>
                  ))}
                </div>

                {/* Task Swimlanes */}
                <div className="space-y-6">
                  {/* Grazy swimlane */}
                  <div className="relative h-16 rounded-xl border border-amber-100/60 bg-amber-50/30">
                    <div className="absolute left-0 top-2 flex h-10 w-4/5 items-center rounded-lg border border-amber-200 bg-gradient-to-r from-amber-200 to-amber-100 px-3 shadow-sm">
                      <span className="text-xs font-light text-amber-900">Add licensing support</span>
                    </div>
                  </div>

                  {/* Inklebot swimlane */}
                  <div className="relative h-16 rounded-xl border border-slate-100/60 bg-slate-50/30">
                    <div className="absolute left-1/4 top-2 flex h-10 w-2/5 items-center rounded-lg border border-slate-300 bg-gradient-to-r from-slate-300 to-slate-200 px-3 shadow-sm">
                      <span className="text-xs font-light text-slate-700">Export tokens as sheets</span>
                    </div>
                  </div>

                  {/* Plumy swimlane */}
                  <div className="relative h-16 rounded-xl border border-green-100/60 bg-green-50/30">
                    <div className="absolute left-0 top-2 h-10 w-1/4 rounded-lg border border-green-300 bg-gradient-to-r from-green-300 to-green-200 shadow-sm"></div>
                  </div>

                  {/* Website swimlane */}
                  <div className="relative h-16 rounded-xl border border-purple-100/60 bg-purple-50/30"></div>
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
