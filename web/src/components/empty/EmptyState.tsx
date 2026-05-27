type EmptyStateProps = {
  title: string;
  message: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="grid min-h-[240px] place-items-center rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-panel-glass)] p-8 text-center font-mono shadow-[var(--shadow-panel)]">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid h-2 w-20 grid-cols-10 gap-px">
          {Array.from({ length: 10 }, (_, index) => (
            <span key={index} className="bg-[var(--color-accent)] shadow-[var(--shadow-glow)]" />
          ))}
        </div>
        <h2 className="text-base font-semibold uppercase text-[var(--color-text)]">{title}</h2>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">{message}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
