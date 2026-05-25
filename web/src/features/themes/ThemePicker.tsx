import { themePresets, type ThemeId } from "@/theme/presets";
import { useUiStore } from "@/stores/uiStore";

export function ThemePicker() {
  const themeId = useUiStore((state) => state.themeId);
  const setTheme = useUiStore((state) => state.setTheme);

  return (
    <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-1">
      {themePresets.map((theme) => (
        <button
          key={theme.id}
          type="button"
          onClick={() => setTheme(theme.id as ThemeId)}
          className="h-7 rounded-[var(--radius-control)] px-2 font-mono text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-row-hover)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-text)]"
          data-active={theme.id === themeId}
          title={theme.name}
        >
          {theme.name}
        </button>
      ))}
    </div>
  );
}
