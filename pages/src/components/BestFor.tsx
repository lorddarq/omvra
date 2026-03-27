const BestFor = () => {
  const groups = [
    {
      title: 'Product & Engineering Teams',
      description:
        'Plan delivery across projects, switch from timeline planning to Kanban execution, and keep ownership clear.',
    },
    {
      title: 'Design & Creative Leads',
      description:
        'Track review-heavy work with markdown-rich task briefs and clear status flow from draft to final.',
    },
    {
      title: 'Operations & Agency Managers',
      description:
        'Coordinate multiple clients or streams, assign people across projects, and monitor task-based workload balance.',
    },
    {
      title: 'AI-Assisted Teams',
      description:
        'Use MCP-connected agents to inspect assigned work, follow guided handoff flows, and keep human review explicit.',
    },
  ];

  return (
    <section id="best-for" className="py-28 bg-nordic-gray-50">
      <div className="container mx-auto px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl font-light text-nordic-gray-800 mb-6 text-center">
            Who this is best for
          </h2>
          <p className="text-xl text-nordic-gray-600 font-light mb-16 text-center max-w-3xl mx-auto">
            Teams that need visual planning, fast execution, and practical workload clarity without extra tooling overhead.
          </p>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-8">
            {groups.map((group) => (
              <div key={group.title} className="rounded-2xl border border-nordic-gray-200 bg-white p-7">
                <h3 className="text-2xl font-light text-nordic-gray-800 mb-3">{group.title}</h3>
                <p className="text-nordic-gray-600 font-light leading-relaxed">{group.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BestFor;
