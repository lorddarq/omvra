const Hero = () => {
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
            <a href="#features" className="text-nordic-gray-600 hover:text-nordic-gray-800 transition-colors text-sm font-light">Features</a>
            <a href="#best-for" className="text-nordic-gray-600 hover:text-nordic-gray-800 transition-colors text-sm font-light">Best For</a>
            <a href="#privacy" className="text-nordic-gray-600 hover:text-nordic-gray-800 transition-colors text-sm font-light">Privacy</a>
            <a href="#download" className="text-nordic-gray-600 hover:text-nordic-gray-800 transition-colors text-sm font-light">Download</a>
          </div>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="container mx-auto px-6 pt-24 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-6xl md:text-7xl font-light text-nordic-gray-800 mb-8 tracking-tight leading-tight">
            Project management,
            <br />
            <span className="text-nordic-blue">simplified</span>
          </h1>
          <p className="text-xl md:text-2xl text-nordic-gray-600 font-light mb-16 leading-relaxed max-w-2xl mx-auto">
            A local-first desktop planner with Timeline and Kanban views, markdown task details, multi-project assignment, and people workload visibility.
          </p>
          <a
            href="#download"
            className="inline-block px-12 py-4 bg-nordic-gray-800 text-white font-light text-lg rounded-lg hover:bg-nordic-gray-700 transition-colors"
          >
            Download for macOS
          </a>
          <p className="mt-6 text-sm text-nordic-gray-500 font-light">
            Also available for Windows and Linux
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
