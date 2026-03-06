const PrivacyProof = () => {
  const proofPoints = [
    {
      title: 'No analytics SDKs',
      description:
        'No Google Analytics, Mixpanel, Segment, PostHog, Sentry, or similar tracking libraries are integrated in the app runtime.',
    },
    {
      title: 'Local-only task data',
      description:
        'Tasks, people, and settings are stored locally on your machine using browser localStorage and Electron local store APIs.',
    },
    {
      title: 'No account or sign-in flow',
      description:
        'There is no authentication layer, user account creation, or profile sync endpoint in the desktop application.',
    },
    {
      title: 'No background data upload',
      description:
        'Outbound network behavior is limited to user-initiated external links (for example release download links), not hidden telemetry.',
    },
  ];

  return (
    <section id="privacy" className="py-28 bg-white">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl font-light text-nordic-gray-800 mb-6 text-center">
            No Data Collection
          </h2>
          <p className="text-xl text-nordic-gray-600 font-light mb-16 text-center max-w-3xl mx-auto">
            Plumy is built as a local-first desktop app. Your planning data stays on your computer and is not sent to analytics platforms.
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
  );
};

export default PrivacyProof;
