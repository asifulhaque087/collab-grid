// Presentational shell for an auth page: heading, subtitle, body slot, and an
// optional footer line. Styled with the shared design tokens to match the
// landing page surface/border palette.
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-[420px] rounded-xl border border-border-soft bg-surface p-8 shadow-lg">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-text">
        {title}
      </h1>
      <p className="mt-2 text-[0.9rem] text-text-dim">{subtitle}</p>
      <div className="mt-6">{children}</div>
      {footer && (
        <p className="mt-6 text-center text-[0.85rem] text-text-dim">{footer}</p>
      )}
    </div>
  );
}

// Horizontal "or" divider used between the OAuth button and the email form.
export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[0.7rem] uppercase tracking-widest text-text-muted">
        or
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
