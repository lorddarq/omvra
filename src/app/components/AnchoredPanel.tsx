import { ArrowLeft, X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from './ui/button';
import { cn } from './ui/utils';

export interface AnchoredPanelNavItem {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface AnchoredPanelNavGroup {
  label: string;
  items: AnchoredPanelNavItem[];
}

interface AnchoredPanelProps {
  title: string;
  description?: string;
  navGroups: AnchoredPanelNavGroup[];
  initialAnchor?: string;
  onBack?: () => void;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function AnchoredPanel({
  title,
  description,
  navGroups,
  initialAnchor,
  onBack,
  onClose,
  children,
  footer,
  className,
}: AnchoredPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const enabledItems = useMemo(
    () => navGroups.flatMap(group => group.items).filter(item => !item.disabled),
    [navGroups]
  );
  const firstAnchor = enabledItems[0]?.id;
  const [activeAnchor, setActiveAnchor] = useState(initialAnchor ?? firstAnchor ?? '');

  useEffect(() => {
    const nextAnchor = initialAnchor ?? firstAnchor ?? '';
    setActiveAnchor(nextAnchor);
  }, [firstAnchor, initialAnchor]);

  const scrollToSection = (anchorId: string) => {
    const scrollNode = scrollRef.current;
    if (!scrollNode) return;

    const section = scrollNode.querySelector<HTMLElement>(`[data-anchored-panel-section="${anchorId}"]`);
    if (!section) return;

    section.scrollIntoView({ block: 'start', behavior: 'smooth' });
    setActiveAnchor(anchorId);
  };

  const syncActiveSection = () => {
    const scrollNode = scrollRef.current;
    if (!scrollNode) return;

    const sections = Array.from(
      scrollNode.querySelectorAll<HTMLElement>('[data-anchored-panel-section]')
    );
    const lastSection = sections[sections.length - 1];
    if (lastSection && scrollNode.scrollTop + scrollNode.clientHeight >= scrollNode.scrollHeight - 8) {
      setActiveAnchor(lastSection.dataset.anchoredPanelSection ?? '');
      return;
    }

    const scrollTop = scrollNode.scrollTop;
    const nextSection = sections
      .map(section => ({
        id: section.dataset.anchoredPanelSection ?? '',
        distance: Math.abs(section.offsetTop - scrollTop - 24),
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (nextSection?.id) {
      setActiveAnchor(nextSection.id);
    }
  };

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-white', className)}>
      <div className="flex shrink-0 items-start justify-between gap-4 border-b px-6 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {onBack && (
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Go back">
              <ArrowLeft className="size-4" />
            </Button>
          )}
          <div className="min-w-0 space-y-1">
            <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
            {description && <p className="text-sm text-gray-500">{description}</p>}
          </div>
        </div>
        {onClose && (
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[176px_minmax(0,1fr)] sm:grid-rows-none">
        <AnchoredPanelNav
          groups={navGroups}
          activeAnchor={activeAnchor}
          onSelect={scrollToSection}
        />
        <AnchoredPanelScrollView ref={scrollRef} onScroll={syncActiveSection}>
          {children}
        </AnchoredPanelScrollView>
      </div>

      {footer && (
        <div className="shrink-0 border-t bg-white px-6 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

interface AnchoredPanelNavProps {
  groups: AnchoredPanelNavGroup[];
  activeAnchor: string;
  onSelect: (anchorId: string) => void;
}

export function AnchoredPanelNav({ groups, activeAnchor, onSelect }: AnchoredPanelNavProps) {
  return (
    <nav className="min-h-0 overflow-y-auto border-b bg-gray-50 px-3 py-4 sm:border-b-0 sm:border-r" aria-label="Panel sections">
      <div className="flex gap-3 sm:block sm:space-y-5">
        {groups.map(group => (
          <div key={group.label} className="min-w-36 space-y-2 sm:min-w-0">
            <p className="px-2 text-xs font-semibold uppercase text-gray-500">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  aria-current={activeAnchor === item.id ? 'true' : undefined}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'flex w-full flex-col rounded-md px-2 py-2 text-left text-sm outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2',
                    activeAnchor === item.id
                      ? 'bg-white font-medium text-gray-950 shadow-sm'
                      : 'text-gray-600 hover:bg-white hover:text-gray-950',
                    item.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {item.description && (
                    <span className="mt-0.5 line-clamp-2 text-xs font-normal text-gray-500">
                      {item.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}

interface AnchoredPanelScrollViewProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

export const AnchoredPanelScrollView = forwardRef<HTMLDivElement, AnchoredPanelScrollViewProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('min-h-0 overflow-y-auto px-6 py-6', className)}
      {...props}
    >
      <div className="mx-auto w-full max-w-3xl space-y-6">
        {children}
      </div>
    </div>
  )
);
AnchoredPanelScrollView.displayName = 'AnchoredPanelScrollView';

interface AnchoredPanelSectionProps extends ComponentPropsWithoutRef<'section'> {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}

export function AnchoredPanelSection({
  id,
  title,
  description,
  children,
  className,
  ...props
}: AnchoredPanelSectionProps) {
  const titleId = `${id}-title`;

  return (
    <section
      id={id}
      data-anchored-panel-section={id}
      aria-labelledby={titleId}
      className={cn('scroll-mt-6 space-y-3', className)}
      {...props}
    >
      <div className="space-y-1">
        <h3 id={titleId} className="text-sm font-semibold text-gray-950">
          {title}
        </h3>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}
