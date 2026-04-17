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

  const cardSpans = [
    'md:col-span-7',
    'md:col-span-5',
    'md:col-span-5',
    'md:col-span-7',
  ]

  return (
    <section id="privacy" className="bg-white py-24 md:py-28">
      <div className="container mx-auto px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-6 text-center text-4xl font-normal tracking-[-0.03em] text-black md:text-5xl">
            Local by design
          </h2>
          <p className="mx-auto mb-14 max-w-3xl text-center text-lg font-normal leading-8 text-[#6B6B6B] md:mb-16 md:text-xl">
            Plumy is designed for teams that want more control, fewer surprises, and a planning tool that does not treat their work like a source of telemetry.
          </p>

          <div className="grid gap-6 md:grid-cols-12">
            {proofPoints.map((point, index) => (
              <div
                key={point.title}
                className={`group relative flex min-h-[17rem] flex-col justify-end overflow-hidden rounded-2xl border border-black/10 bg-[#FCFDE8] p-7 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(176,200,26,0.14)] md:min-h-[20rem] md:p-8 ${cardSpans[index]}`}
              >
                <div className="absolute inset-x-0 top-0 h-[3px] bg-[#B0C81A]" />
                <h3 className="mb-4 max-w-[16ch] text-2xl font-normal leading-tight tracking-[-0.02em] text-[#687912]">
                  {point.title}
                </h3>
                <p className="text-base font-normal leading-7 text-black">
                  {point.description}
                </p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm font-normal leading-6 text-black/70">
            Audit basis: app renderer and Electron main/preload paths checked for telemetry, analytics, and auto-upload behavior.
          </p>
        </div>
      </div>
    </section>
  )
}

export default PrivacyProof
