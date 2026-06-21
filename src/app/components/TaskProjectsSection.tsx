interface TaskProjectsSectionProps {
  projectLabels: string[];
}

export function TaskProjectsSection({ projectLabels }: TaskProjectsSectionProps) {
  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-[#71717a]/10 bg-white p-4">
      <div className="text-sm font-semibold leading-5 text-[#71717a]">Projects</div>
      {projectLabels.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {projectLabels.map(projectName => (
            <span
              key={projectName}
              className="inline-flex min-h-5 max-w-full items-center break-words rounded-full border border-black/10 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-[#71717a] [overflow-wrap:anywhere]"
            >
              {projectName}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-sm text-[#71717a]">No projects assigned.</div>
      )}
    </div>
  );
}
