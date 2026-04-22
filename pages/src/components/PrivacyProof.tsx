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
            <article
              className={`relative overflow-hidden rounded-[30px] bg-[#FCFDE8] p-8 shadow-[0_18px_44px_rgba(104,121,18,0.10)] md:min-h-[22rem] md:p-10 ${cardSpans[0]}`}
            >
              <div className="absolute inset-x-0 top-0 h-[4px] bg-[#B0C81A]" />
              <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(13rem,0.52fr)] md:items-start">
                <div>
                  <h3 className="mb-5 max-w-[10ch] text-[2.35rem] font-normal leading-[0.98] tracking-[-0.045em] text-[#687912] md:text-[3rem]">
                    {proofPoints[0].title}
                  </h3>
                  <p className="max-w-2xl text-base font-normal leading-8 text-black md:text-lg">
                    {proofPoints[0].description}
                  </p>
                </div>
                <div className="border-t border-black/10 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                  <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-black/55">
                    Practical effect
                  </p>
                  <p className="text-sm leading-5 text-black/80">
                    Your tasks, comments, people, and backup exports stay part of your own desktop workflow rather than a hosted account system.
                  </p>
                </div>
              </div>
            </article>

            <article
              className={`flex min-h-[22rem] flex-col rounded-[30px] bg-[#F4F7D8] p-7 md:p-8 ${cardSpans[1]}`}
            >
              <div>
                <h3 className="mb-4 max-w-[12ch] text-2xl font-normal leading-tight tracking-[-0.03em] text-[#687912] md:text-[2rem]">
                  {proofPoints[1].title}
                </h3>
                <p className="text-base leading-6 text-black">{proofPoints[1].description}</p>
              </div>
              <p className="mt-auto border-t border-black/10 pt-4 text-sm leading-5 text-black/65">
                Open the app, download a release, and start planning without another signup step in the middle.
              </p>
            </article>

            <article
              className={`flex min-h-[17rem] flex-col rounded-[30px] bg-[#FAFBEF] p-7 md:min-h-[18rem] md:p-8 ${cardSpans[2]}`}
            >
              <h3 className="mb-4 max-w-[14ch] text-2xl font-normal leading-tight tracking-[-0.03em] text-[#687912]">
                {proofPoints[2].title}
              </h3>
              <p className="text-base leading-6 text-black">{proofPoints[2].description}</p>
            </article>

            <article
              className={`rounded-[30px] bg-[#F7F9E6] p-7 md:p-8 ${cardSpans[3]}`}
            >
              <div className="grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] md:items-start">
                <div>
                  <h3 className="mb-4 max-w-[13ch] text-2xl font-normal leading-tight tracking-[-0.03em] text-[#687912] md:text-[2rem]">
                    {proofPoints[3].title}
                  </h3>
                </div>
                <p className="text-base leading-6 text-black">
                  {proofPoints[3].description}
                </p>
              </div>
            </article>
          </div>

          <p className="mx-auto mt-8 max-w-2xl text-center text-sm font-normal leading-5 text-black/70">
            Audit basis: app renderer and Electron main/preload paths checked for telemetry, analytics, and auto-upload behavior.
          </p>
        </div>
      </div>
    </section>
  )
}

export default PrivacyProof
