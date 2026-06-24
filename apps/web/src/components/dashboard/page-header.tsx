export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex items-start justify-between">
      <div>
        <h1 className="text-[1.6rem] font-bold tracking-tight text-text">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.875rem] text-text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  actions,
}: {
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-text">{title}</h2>
      {actions}
    </div>
  );
}
