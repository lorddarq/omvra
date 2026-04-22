const Footer = () => {
  const linkClassName =
    'text-sm font-normal text-black transition-colors duration-200 hover:text-[#6C4FE0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D5CEF1] focus-visible:ring-offset-2'

  return (
    <footer className="border-t border-black/8 bg-[#FAFAF8]">
      <div className="container mx-auto px-6 py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.8fr))] lg:gap-10">
          <div className="max-w-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-[#6C4FE0]/45" />
              <span className="text-xl font-semibold tracking-[-0.03em] text-black">plumy</span>
            </div>
            <p className="text-sm font-normal leading-6 text-[#656565]">
              Open-source, local-first planning for teams that want clarity without the usual overhead.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-normal uppercase tracking-[0.14em] text-black/60">Product</h4>
            <ul className="space-y-3">
              <li><a href="#why-plumy" className={linkClassName}>Why Plumy</a></li>
              <li><a href="#features" className={linkClassName}>Features</a></li>
              <li><a href="#how-it-works" className={linkClassName}>How it works</a></li>
              <li><a href="#privacy" className={linkClassName}>Privacy</a></li>
              <li><a href="#download" className={linkClassName}>Download</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-normal uppercase tracking-[0.14em] text-black/60">Proof</h4>
            <ul className="space-y-3">
              <li><a href="https://github.com/lorddarq/Plumy" className={linkClassName}>GitHub repository</a></li>
              <li><a href="https://github.com/lorddarq/Plumy/releases" className={linkClassName}>Releases</a></li>
              <li><a href="https://github.com/lorddarq/Plumy#readme" className={linkClassName}>Documentation</a></li>
              <li><a href="#agent-prompts" className={linkClassName}>AI workflows</a></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-normal uppercase tracking-[0.14em] text-black/60">Project</h4>
            <ul className="space-y-3">
              <li><a href="https://github.com/lorddarq/Plumy/blob/main/LICENSE" className={linkClassName}>License</a></li>
              <li><a href="https://github.com/lorddarq/Plumy/issues" className={linkClassName}>Issues</a></li>
              <li><a href="https://github.com/lorddarq/Plumy/actions" className={linkClassName}>Build status</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-black/8 pt-8">
          <div className="flex flex-col items-center justify-between gap-2 text-center md:flex-row md:text-left">
            <p className="text-sm font-normal text-[#656565]">© 2026 Plumy. All rights reserved.</p>
            <a
              href="https://grazy.sorinjurcut.com/"
              className="text-sm font-normal text-[#656565] transition-colors duration-200 hover:text-[#6C4FE0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D5CEF1] focus-visible:ring-offset-2"
            >
              Built with Grazy in Figma
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
