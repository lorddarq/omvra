export function AtomSpinner({ className = '', size = 16, ...props }: { className?: string; size?: number } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`atom-spinner ${className}`}
      style={{ '--atom-size': `${size}px` } as React.CSSProperties}
      role="img"
      aria-label="Working"
      {...props}
    >
      <span className="atom-spinner-shell" aria-hidden="true" />
      {[0, 1, 2].map(index => (
        <span key={index} className="atom-spinner-spin" style={{ '--atom-step': index } as React.CSSProperties} aria-hidden="true">
          <span className="atom-spinner-ring" />
        </span>
      ))}
    </span>
  );
}
