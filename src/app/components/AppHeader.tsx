import { Settings, User } from 'lucide-react';
import logo from '../images/logo.svg';
import { Button } from './ui/button';
import { ViewToggle } from './ViewToggle';
import { ViewType } from '../hooks/useViewState';

interface AppHeaderProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onOpenPreferences: () => void;
  onOpenPeople: () => void;
}

export function AppHeader({
  currentView,
  onViewChange,
  onOpenPreferences,
  onOpenPeople,
}: AppHeaderProps) {
  return (
    <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <img src={logo} alt="Plumy" className="h-10 w-auto antialiased" />
          <p className="text-lg font-semibold">plumy</p>
        </div>
        <ViewToggle currentView={currentView} onViewChange={onViewChange} />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onOpenPreferences} aria-label="Open preferences">
          <Settings className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenPeople} aria-label="Open people panel">
          <User className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
