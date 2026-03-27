const PrivacyProof = () => {
  const proofPoints = [
    {
      title: 'Your plans stay on your machine',
      description:
        'Tasks, comments, people, settings, and workspace backups are stored locally through the desktop app instead of being pushed into a hosted planning service.',
    },
    {
      title: 'No account required',
      description:
        'You can download Plumy and start using it without sign-up flows, user profiles, or another shared admin surface to manage.',
    },
    {
      title: 'No hidden telemetry',
      description:
        'There are no embedded analytics SDKs silently tracking routine product usage in the app runtime.',
    },
    {
      title: 'Network access stays explicit',
      description:
        'Outbound traffic is limited to user-initiated actions such as release downloads or MCP access you explicitly enable, not background surprise uploads.',
    },
  ]

  return (
    <section id="privacy" className="py-28 bg-white">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl font-light text-nordic-gray-800 mb-6 text-center">
            Local by design
          </h2>
          <p className="text-xl text-nordic-gray-600 font-light mb-16 text-center max-w-3xl mx-auto">
            Plumy is designed for teams that want more control, fewer surprises, and a planning tool that does not treat their work like a source of telemetry.
          </p>

          <div className="grid md:grid-cols-2 gap-8">
            {proofPoints.map((point) => (
              <div key={point.title} className="rounded-2xl border border-nordic-gray-200 bg-nordic-gray-50 p-6">
                <h3 className="text-2xl font-light text-nordic-gray-800 mb-3">{point.title}</h3>
                <p className="text-nordic-gray-600 font-light leading-relaxed">{point.description}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-nordic-gray-500 text-center">
            Audit basis: app renderer and Electron main/preload paths checked for telemetry, analytics, and auto-upload behavior.
          </p>
        </div>
      </div>
    </section>
  )
}

export default PrivacyProof
