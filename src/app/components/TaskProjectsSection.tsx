interface TaskProjectsSectionProps {
  projectLabels: string[];
}

export function TaskProjectsSection({ projectLabels }: TaskProjectsSectionProps) {
  return (
    <div className="min-w-0 space-y-2 rounded-md border bg-white p-4">
      <div className="text-sm font-semibold text-gray-900">Projects</div>
      {projectLabels.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-2">
          {projectLabels.map(projectName => (
            <span
              key={projectName}
              className="max-w-full break-words rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700 [overflow-wrap:anywhere]"
            >
              {projectName}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500">No projects assigned.</div>
      )}
    </div>
  );
}
