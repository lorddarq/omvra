import { Atom } from 'loading-dev';

export function AtomSpinner({ className = '', size = 16, ...props }: { className?: string; size?: number } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`inline-flex shrink-0 ${className}`} role="img" aria-label="Working" {...props}>
      <Atom size={size} duration={1450} />
    </span>
  );
}
