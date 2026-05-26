type EmptyStateProps = {
  title: string;
  message: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="grid min-h-[240px] place-items-center rounded-[var(--radius-panel)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-panel-glass)] p-8 text-center shadow-[var(--shadow-panel)] backdrop-blur">
      <div className="max-w-md">
        <div className="mx-auto mb-4 h-2 w-20 rounded-full bg-[var(--color-accent)] shadow-[var(--shadow-glow)]" />
        <h2 className="font-mono text-lg font-semibold text-[var(--color-text)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{message}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}
