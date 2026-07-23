import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './ui/utils';
import { VerticalScrollbar } from './VerticalScrollbar';

export function FeatheredScrollList({
  children,
  className,
  scrollClassName,
}: {
  children: ReactNode;
  className?: string;
  scrollClassName?: string;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const node = scrollContainerRef.current;
    if (!node) return;
    const syncOverflow = () => setHasOverflow(node.scrollHeight > node.clientHeight + 1);
    syncOverflow();
    const observer = new ResizeObserver(syncOverflow);
    observer.observe(node);
    if (node.lastElementChild instanceof HTMLElement) observer.observe(node.lastElementChild);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div ref={scrollContainerRef} className={cn('feathered-scrollbar overflow-y-scroll', scrollClassName)}>
        {hasOverflow && <div className="pointer-events-none sticky top-[calc(100%-1.5rem)] z-10 -mb-6 h-6 bg-gradient-to-t from-white via-white/92 to-transparent" />}
        {children}
      </div>
      <VerticalScrollbar scrollContainerRef={scrollContainerRef} ariaLabel="List scroll" />
    </div>
  );
}
