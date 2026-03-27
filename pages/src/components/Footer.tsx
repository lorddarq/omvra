const Footer = () => {
  return (
    <footer className="bg-white border-t border-nordic-gray-200">
      <div className="container mx-auto px-6 py-16">
        <div className="grid gap-12 mb-12 md:grid-cols-4">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-nordic-blue rounded-lg"></div>
              <span className="text-xl font-light text-nordic-gray-800">Plumy</span>
            </div>
            <p className="text-sm text-nordic-gray-600 font-light leading-relaxed">
              Open-source, local-first planning for teams that want clarity without the usual overhead.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-nordic-gray-800 mb-4 uppercase tracking-wider">Product</h4>
            <ul className="space-y-3">
              <li><a href="#why-plumy" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">Why Plumy</a></li>
              <li><a href="#features" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">How it works</a></li>
              <li><a href="#privacy" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">Privacy</a></li>
              <li><a href="#download" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">Download</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-nordic-gray-800 mb-4 uppercase tracking-wider">Proof</h4>
            <ul className="space-y-3">
              <li><a href="https://github.com/lorddarq/Plumy" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">GitHub repository</a></li>
              <li><a href="https://github.com/lorddarq/Plumy/releases" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">Releases</a></li>
              <li><a href="https://github.com/lorddarq/Plumy#readme" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">Documentation</a></li>
              <li><a href="#agent-prompts" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">AI workflows</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-medium text-nordic-gray-800 mb-4 uppercase tracking-wider">Project</h4>
            <ul className="space-y-3">
              <li><a href="https://github.com/lorddarq/Plumy/blob/main/LICENSE" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">License</a></li>
              <li><a href="https://github.com/lorddarq/Plumy/issues" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">Issues</a></li>
              <li><a href="https://github.com/lorddarq/Plumy/actions" className="text-sm text-nordic-gray-600 hover:text-nordic-gray-800 font-light transition-colors">Build status</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-nordic-gray-200">
          <p className="text-sm text-nordic-gray-500 font-light text-center">
            © 2026 Plumy. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
