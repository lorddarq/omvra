import { Button } from './ui/button';
import { ViewToggle } from './ViewToggle';
import { ViewType } from '../hooks/useViewState';
import { AgentIcon } from './AgentIcon';
import { UsersIcon } from './UsersIcon';

interface AppHeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onOpenPreferences: () => void;
  onOpenPeople: () => void;
  onOpenAgents: () => void;
}

export function AppHeader({
  currentView,
  onViewChange,
  onOpenPreferences,
  onOpenPeople,
  onOpenAgents,
}: AppHeaderProps) {
  return (
    <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.8584 12.665C10.3078 12.6651 11.4832 13.8397 11.4834 15.2891C11.4834 16.7386 10.3079 17.914 8.8584 17.9141C7.40883 17.9141 6.2334 16.7386 6.2334 15.2891C6.23355 13.8397 7.40893 12.665 8.8584 12.665Z" fill="url(#paint0_linear_562_571)"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M16 3.86133C18.0997 3.86133 25.2112 4.3372 26.835 5.28906C28.4586 6.2129 29.7184 7.50072 30.6143 9.15234C31.5381 10.804 31.9999 12.7078 32 14.8633C32 17.019 31.5521 18.9234 30.6562 20.5752C30.1245 21.5555 29.4629 22.4108 28.6748 23.1445C28.4982 23.3832 27.2241 24.9431 23.0996 26.3896C18.6191 27.9609 14.1943 28.1387 14.1943 28.1387V25.8008C11.2339 25.6475 6.51203 25.2104 5.20703 24.4805C3.58338 23.5286 2.30958 22.2268 1.38574 20.5752C0.461858 18.9234 0 17.019 0 14.8633C6.60297e-05 12.7078 0.447928 10.804 1.34375 9.15234C2.26759 7.50072 3.54139 6.2129 5.16504 5.28906C6.78884 4.3372 13.9003 3.86133 16 3.86133ZM16 8.18652C14.8241 8.18652 8.53847 8.46645 7.64258 9.02637C6.74684 9.58626 6.04686 10.3702 5.54297 11.3779C5.03909 12.3857 4.78717 13.5477 4.78711 14.8633C4.78711 16.1791 5.03903 17.3418 5.54297 18.3496C6.07485 19.3293 6.78882 20.1133 7.68457 20.7012C8.36912 21.116 12.0053 21.3759 14.3213 21.4834C18.0015 21.6542 16 8.18652 18.7666 8.30176C17.5088 8.22556 16.4233 8.18652 16 8.18652ZM21.1338 13.2666V17.3125H25.1807V13.2666H21.1338Z" fill="url(#paint1_linear_562_571)"/>
            <defs>
            <linearGradient id="paint0_linear_562_571" x1="16" y1="3.86133" x2="16" y2="28.1387" gradientUnits="userSpaceOnUse">
            <stop offset="0.0192308" stopColor="#1F2A56"/>
            <stop offset="0.649038" stopColor="#949FAA"/>
            <stop offset="0.884615" stopColor="#D2BCA2"/>
            <stop offset="1" stopColor="#F1C39A"/>
            </linearGradient>
            <linearGradient id="paint1_linear_562_571" x1="16" y1="3.86133" x2="16" y2="28.1387" gradientUnits="userSpaceOnUse">
            <stop offset="0.0192308" stopColor="#1F2A56"/>
            <stop offset="0.649038" stopColor="#949FAA"/>
            <stop offset="0.884615" stopColor="#D2BCA2"/>
            <stop offset="1" stopColor="#F1C39A"/>
            </linearGradient>
            </defs>
          </svg>
        </div>
        <ViewToggle currentView={currentView} onViewChange={onViewChange} />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenPeople} aria-label="Open people settings" className="text-[#8B8B93]">
          <UsersIcon />
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenAgents} aria-label="Open agents settings" className="text-[#8B8B93]">
          <AgentIcon />
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenPreferences} aria-label="Open preferences" className="text-[#8B8B93]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4">
            <path fillRule="evenodd" d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 0 0 0 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 0 0-.432 2.385l.922 1.597a1.875 1.875 0 0 0 2.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 0 0 2.28-.819l.923-1.597a1.875 1.875 0 0 0-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 0 0 0-1.139c-.016-.2.059-.352.153-.43l.84-.692c.708-.582.891-1.59.433-2.385l-.922-1.597a1.875 1.875 0 0 0-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 0 0-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 0 0-1.85-1.567h-1.843ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" clipRule="evenodd" />
          </svg>
        </Button>
      </div>
    </header>
  );
}
