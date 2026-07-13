const illustrationBase = `${import.meta.env.BASE_URL}illustrations`

const pillars = [
  {
    title: 'No account',
    description:
      'Download it and start working. No user profile, hosted workspace, or password account is required.',
    illustration: 'local-by-design-01.svg',
    widthClassName: 'w-[8.5rem] md:w-[9rem]',
  },
  {
    title: 'Local workspace',
    description:
      'Your planning data stays in the local app workspace instead of being stored in a vendor database.',
    illustration: 'local-by-design-02.svg',
    widthClassName: 'w-[8.8rem] md:w-[9.2rem]',
  },
  {
    title: 'Network by choice',
    description:
      'Normal planning works offline. Enable token-secured MCP access or online actions only when you choose.',
    illustration: 'local-by-design-03.svg',
    widthClassName: 'w-[8.6rem] md:w-[9.1rem]',
  },
] as const

const PrivacyProof = () => {
  return (
    <section id="privacy" className="bg-[#fbfaf8] py-24 md:py-28">
      <div className="landing-container">
        <div className="mx-auto max-w-[72rem]">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance text-[clamp(2.9rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#5b5966]">
              Keep sensitive work close.
            </h2>
            <p className="mx-auto mt-7 max-w-[36rem] text-pretty text-lg leading-9 text-[#6d6a73] sm:text-[1.35rem]">
              Omvra is built for people who need the speed of AI-assisted work without placing
              project context in another cloud account.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-[72rem]">
            <div className="rounded-[1.75rem] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,247,244,0.96)_100%)] shadow-[0_2px_8px_rgba(17,24,39,0.04),0_16px_36px_rgba(17,24,39,0.04)]">
              <div className="grid md:grid-cols-3">
                {pillars.map((pillar, index) => (
                  <article
                    key={pillar.title}
                    className={`flex flex-col items-start px-9 pb-8 pt-10 text-left md:min-h-[24.875rem] md:px-9 md:pb-10 md:pt-12 ${
                      index < pillars.length - 1 ? 'border-b border-black/6 md:border-b-0 md:border-r' : ''
                    }`}
                  >
                    <div className="flex min-h-[9.5rem] w-full items-start justify-center">
                      <img
                        src={`${illustrationBase}/${pillar.illustration}`}
                        alt=""
                        className={`h-auto ${pillar.widthClassName}`}
                        loading="lazy"
                      />
                    </div>

                    <h3 className="mt-3 text-[2.1rem] font-medium leading-[1.08] tracking-[-0.05em] text-[#5b5966]">
                      {pillar.title}
                    </h3>
                    <p className="mt-4 max-w-[16rem] text-base text-[#77737c]">
                      {pillar.description}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default PrivacyProof
