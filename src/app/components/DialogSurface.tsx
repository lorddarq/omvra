import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { cn } from './ui/utils';

export function DialogSurface({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        'max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto rounded-[28px] border-white/70 bg-[#f3f4f6] p-0 shadow-[0_24px_80px_rgba(15,23,42,0.18)]',
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

interface DialogSurfaceHeaderProps extends ComponentPropsWithoutRef<'div'> {
  title: ReactNode;
  description?: ReactNode;
}

export function DialogSurfaceHeader({
  title,
  description,
  className,
  ...props
}: DialogSurfaceHeaderProps) {
  return (
    <DialogHeader className={cn('border-b border-black/6 px-6 py-5 text-left', className)} {...props}>
      <DialogTitle className="break-words text-[1.1rem] font-semibold tracking-[-0.02em] text-[#111827] [overflow-wrap:anywhere]">
        {title}
      </DialogTitle>
      {description ? (
        <DialogDescription className="max-w-[44rem] text-sm leading-6 text-[#6b7280]">
          {description}
        </DialogDescription>
      ) : null}
    </DialogHeader>
  );
}

export function DialogSurfaceBody({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('min-w-0 space-y-4 px-6 py-5', className)} {...props} />;
}

export function DialogSurfaceSection({
  className,
  ...props
}: ComponentPropsWithoutRef<'section'>) {
  return (
    <section
      className={cn(
        'rounded-[24px] border border-black/6 bg-white/70 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_24px_rgba(15,23,42,0.05)]',
        className,
      )}
      {...props}
    />
  );
}

export function DialogSurfaceFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogFooter>) {
  return <DialogFooter className={cn('gap-2 border-t border-black/6 px-6 py-5', className)} {...props} />;
}
