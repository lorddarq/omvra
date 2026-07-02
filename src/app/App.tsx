import { AppHeader } from './components/AppHeader';
import { AppMainViews } from './components/AppMainViews';
import { AppPanels } from './components/AppPanels';
import { DeleteConfirmDialog } from './components/DeleteConfirmDialog';
import { useAppShell } from './hooks/useAppShell.ts';
import { UiLayoutStoreProvider } from './store/uiLayoutStore.tsx';
import { WorkspaceStoreProvider, useWorkspaceStore } from './store/workspaceStore.tsx';

function AppContent() {
  const appShell = useAppShell();

  if (!appShell.isHydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading workspace...
      </div>
    );
  }

  return (
    <>
      <div className="flex h-dvh flex-col bg-gray-50">
        <AppHeader {...appShell.headerProps} />
        <AppMainViews {...appShell.mainViewsProps} />
        <AppPanels {...appShell.panelsProps} />
      </div>

      <DeleteConfirmDialog {...appShell.deleteConfirmProps} />
    </>
  );
}

function AppStoreShell() {
  const {
    hasHydratedCanonicalWorkspace,
    timelineSwimlanes,
    people,
    tasks,
    milestones,
  } = useWorkspaceStore();

  return (
    <UiLayoutStoreProvider
      hasHydratedCanonicalWorkspace={hasHydratedCanonicalWorkspace}
      projects={timelineSwimlanes}
      people={people}
      tasks={tasks}
      milestones={milestones}
    >
      <AppContent />
    </UiLayoutStoreProvider>
  );
}

function App() {
  return (
    <WorkspaceStoreProvider>
      <AppStoreShell />
    </WorkspaceStoreProvider>
  );
}

export default App;
