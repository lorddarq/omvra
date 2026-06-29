import { Bot, Settings2, Users2 } from 'lucide-react';
import { Button } from './ui/button';
import { ViewToggle } from './ViewToggle';
import { ViewType } from '../hooks/useViewState';

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
    <header className="app-header">
      <div className="app-header-shell">
        <div className="app-header-primary">
          <div className="app-header-brand" aria-label="Omvra workspace">
            <div className="app-header-brand-mark" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.8584 12.665C10.3078 12.6651 11.4832 13.8397 11.4834 15.2891C11.4834 16.7386 10.3079 17.914 8.8584 17.9141C7.40883 17.9141 6.2334 16.7386 6.2334 15.2891C6.23355 13.8397 7.40893 12.665 8.8584 12.665Z" fill="url(#paint0_linear_562_571)" />
                <path fillRule="evenodd" clipRule="evenodd" d="M16 3.86133C18.0997 3.86133 25.2112 4.3372 26.835 5.28906C28.4586 6.2129 29.7184 7.50072 30.6143 9.15234C31.5381 10.804 31.9999 12.7078 32 14.8633C32 17.019 31.5521 18.9234 30.6562 20.5752C30.1245 21.5555 29.4629 22.4108 28.6748 23.1445C28.4982 23.3832 27.2241 24.9431 23.0996 26.3896C18.6191 27.9609 14.1943 28.1387 14.1943 28.1387V25.8008C11.2339 25.6475 6.51203 25.2104 5.20703 24.4805C3.58338 23.5286 2.30958 22.2268 1.38574 20.5752C0.461858 18.9234 0 17.019 0 14.8633C6.60297e-05 12.7078 0.447928 10.804 1.34375 9.15234C2.26759 7.50072 3.54139 6.2129 5.16504 5.28906C6.78884 4.3372 13.9003 3.86133 16 3.86133ZM16 8.18652C14.8241 8.18652 8.53847 8.46645 7.64258 9.02637C6.74684 9.58626 6.04686 10.3702 5.54297 11.3779C5.03909 12.3857 4.78717 13.5477 4.78711 14.8633C4.78711 16.1791 5.03903 17.3418 5.54297 18.3496C6.07485 19.3293 6.78882 20.1133 7.68457 20.7012C8.36912 21.116 12.0053 21.3759 14.3213 21.4834C18.0015 21.6542 16 8.18652 18.7666 8.30176C17.5088 8.22556 16.4233 8.18652 16 8.18652ZM21.1338 13.2666V17.3125H25.1807V13.2666H21.1338Z" fill="url(#paint1_linear_562_571)" />
                <defs>
                  <linearGradient id="paint0_linear_562_571" x1="16" y1="3.86133" x2="16" y2="28.1387" gradientUnits="userSpaceOnUse">
                    <stop offset="0.0192308" stopColor="#1F2A56" />
                    <stop offset="0.649038" stopColor="#949FAA" />
                    <stop offset="0.884615" stopColor="#D2BCA2" />
                    <stop offset="1" stopColor="#F1C39A" />
                  </linearGradient>
                  <linearGradient id="paint1_linear_562_571" x1="16" y1="3.86133" x2="16" y2="28.1387" gradientUnits="userSpaceOnUse">
                    <stop offset="0.0192308" stopColor="#1F2A56" />
                    <stop offset="0.649038" stopColor="#949FAA" />
                    <stop offset="0.884615" stopColor="#D2BCA2" />
                    <stop offset="1" stopColor="#F1C39A" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="app-header-brand-copy">
              <span className="app-header-brand-eyebrow">Workspace</span>
              <span className="app-header-brand-name">Omvra</span>
            </div>
          </div>

          <div className="app-header-nav" aria-label="Primary views">
            <ViewToggle currentView={currentView} onViewChange={onViewChange} />
          </div>
        </div>

        <div className="app-header-actions" aria-label="Workspace panels">
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenPeople}
            aria-label="Open people settings"
            className="app-header-icon-button"
          >
            <Users2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenAgents}
            aria-label="Open agents settings"
            className="app-header-icon-button"
          >
            <Bot className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenPreferences}
            aria-label="Open preferences"
            className="app-header-icon-button"
          >
            <Settings2 className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
