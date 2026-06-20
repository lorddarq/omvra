import type { ReactNode } from 'react';

interface PeopleSettingsSectionProps {
  children: ReactNode;
  empty?: boolean;
}

export function PeopleSettingsSection({ children, empty = false }: PeopleSettingsSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">People</h3>
        <p className="text-xs text-gray-500">Humans available for task assignment.</p>
      </div>
      {empty ? (
        <div className="rounded-lg border border-dashed py-6 text-center text-sm text-gray-500">
          No people yet.
        </div>
      ) : children}
    </section>
  );
}

export function AgentsSettingsSection({ children, empty = false }: PeopleSettingsSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Agents</h3>
        <p className="text-xs text-gray-500">Agentic personas and their workspace monitoring controls.</p>
      </div>
      {empty ? (
        <div className="rounded-lg border border-dashed py-6 text-center text-sm text-gray-500">
          No agents yet.
        </div>
      ) : children}
    </section>
  );
}
