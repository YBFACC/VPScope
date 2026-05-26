import { useEffect, useMemo, useState } from "react";
import { localeNames, type Locale } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { createCpuAlertRule } from "@/lib/alerts";
import {
  nextAlertSettingsForHost,
  updateAlertRule,
  useAlertSettingsStore,
} from "@/stores/alertSettingsStore";
import { useHostStore } from "@/stores/hostStore";
import {
  defaultTrayLabel,
  nextTraySettingsForHost,
  updateTrayItem,
  useTraySettingsStore,
} from "@/stores/traySettingsStore";
import { useUiStore } from "@/stores/uiStore";
import { themePresets, type ThemeId } from "@/theme/presets";
import type { AlertSettings, HostConfig, TrayItemDisplayMode, TraySettings } from "@/types/contracts";

type SettingsSection = "appearance" | "menuBar" | "alerts";

const alertCooldownOptions = [60_000, 300_000, 600_000, 1_800_000, 3_600_000];

export function SettingsPage() {
  const settingsOpen = useUiStore((state) => state.settingsOpen);
  const setSettingsOpen = useUiStore((state) => state.setSettingsOpen);
  const themeId = useUiStore((state) => state.themeId);
  const setTheme = useUiStore((state) => state.setTheme);
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);
  const hosts = useHostStore((state) => state.hosts);
  const traySettings = useTraySettingsStore((state) => state.settings);
  const traySettingsError = useTraySettingsStore((state) => state.error);
  const isSavingTraySettings = useTraySettingsStore((state) => state.isSaving);
  const loadTraySettings = useTraySettingsStore((state) => state.load);
  const saveTraySettings = useTraySettingsStore((state) => state.save);
  const alertSettings = useAlertSettingsStore((state) => state.settings);
  const alertPermission = useAlertSettingsStore((state) => state.permission);
  const alertSettingsError = useAlertSettingsStore((state) => state.error);
  const isSavingAlertSettings = useAlertSettingsStore((state) => state.isSaving);
  const isRequestingAlertPermission = useAlertSettingsStore((state) => state.isRequestingPermission);
  const loadAlertSettings = useAlertSettingsStore((state) => state.load);
  const saveAlertSettings = useAlertSettingsStore((state) => state.save);
  const requestAlertPermission = useAlertSettingsStore((state) => state.requestPermission);
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [trayDraft, setTrayDraft] = useState<TraySettings>({ items: [] });
  const [alertDraft, setAlertDraft] = useState<AlertSettings>({ rules: [] });
  const { t } = useI18n();
  const trayItemsByHost = useMemo(
    () => new Map(trayDraft.items.map((item) => [item.hostId, item])),
    [trayDraft],
  );
  const alertRulesByHost = useMemo(
    () => new Map(alertDraft.rules.map((rule) => [rule.hostId, rule])),
    [alertDraft],
  );

  useEffect(() => {
    if (settingsOpen) {
      void loadTraySettings();
      void loadAlertSettings();
    }
  }, [loadAlertSettings, loadTraySettings, settingsOpen]);

  useEffect(() => {
    setTrayDraft(traySettings);
  }, [traySettings]);

  useEffect(() => {
    setAlertDraft(alertSettings);
  }, [alertSettings]);

  if (!settingsOpen) {
    return null;
  }

  const setTrayHostEnabled = (host: HostConfig, enabled: boolean) => {
    setTrayDraft((current) => nextTraySettingsForHost(current, host, enabled));
  };

  const setTrayLabel = (host: HostConfig, label: string) => {
    const ensured = nextTraySettingsForHost(trayDraft, host, true);
    setTrayDraft(updateTrayItem(ensured, host.id, { label: label.slice(0, 12) }));
  };

  const setTrayDisplayMode = (host: HostConfig, displayMode: TrayItemDisplayMode) => {
    const ensured = nextTraySettingsForHost(trayDraft, host, true, displayMode);
    setTrayDraft(updateTrayItem(ensured, host.id, { displayMode }));
  };

  const onSaveTraySettings = async () => {
    await saveTraySettings({
      items: trayDraft.items.map((item) => ({
        ...item,
        label: item.label.trim() || "vps",
      })),
    });
  };

  const setAlertHostEnabled = (host: HostConfig, enabled: boolean) => {
    setAlertDraft((current) => nextAlertSettingsForHost(current, host, enabled));
  };

  const setAlertThreshold = (host: HostConfig, thresholdPercent: number) => {
    const ensured = nextAlertSettingsForHost(alertDraft, host, true);
    const rule = ensured.rules.find((candidate) => candidate.hostId === host.id && candidate.metric === "cpu");
    const normalizedThreshold = Number.isFinite(thresholdPercent)
      ? Math.max(1, Math.min(100, thresholdPercent))
      : 90;

    if (!rule) {
      return;
    }

    setAlertDraft(updateAlertRule(ensured, rule.id, { thresholdPercent: normalizedThreshold }));
  };

  const setAlertCooldown = (host: HostConfig, cooldownMs: number) => {
    const ensured = nextAlertSettingsForHost(alertDraft, host, true);
    const rule = ensured.rules.find((candidate) => candidate.hostId === host.id && candidate.metric === "cpu");

    if (!rule) {
      return;
    }

    setAlertDraft(updateAlertRule(ensured, rule.id, { cooldownMs }));
  };

  const onSaveAlertSettings = async () => {
    await saveAlertSettings({
      rules: alertDraft.rules.map((rule) => ({
        ...rule,
        thresholdPercent: Number.isFinite(rule.thresholdPercent)
          ? Math.max(1, Math.min(100, rule.thresholdPercent))
          : 90,
        cooldownMs: alertCooldownOptions.includes(rule.cooldownMs) ? rule.cooldownMs : 600_000,
      })),
    });
  };

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-[var(--color-overlay)] p-4 backdrop-blur-sm">
      <section className="grid h-[min(620px,calc(100vh-2rem))] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[var(--radius-panel)] border border-[var(--color-border-strong)] bg-[var(--color-panel-glass)] shadow-[var(--shadow-panel)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 bg-[var(--color-panel-raised)]">
          <h2 className="px-4 py-3 font-mono text-base font-semibold text-[var(--color-text)]">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[var(--shadow-glow)]" />
            {t("settings")}
          </h2>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="mr-3 grid h-8 w-8 place-items-center rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-row-hover)] hover:text-[var(--color-text)]"
            title={t("close")}
            aria-label={t("close")}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="2"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="grid min-h-0 border-t border-[var(--color-border)] md:grid-cols-[180px_minmax(0,1fr)]">
          <nav className="flex gap-1 border-b border-[var(--color-border)] bg-[var(--color-panel-muted)] p-2 md:flex-col md:items-stretch md:border-b-0 md:border-r">
            {(["appearance", "menuBar", "alerts"] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setSection(candidate)}
                className="h-9 shrink-0 rounded-[var(--radius-control)] border border-transparent px-3 text-left font-mono text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-row-hover)] data-[active=true]:border-[var(--color-border-subtle)] data-[active=true]:bg-[var(--color-input)] data-[active=true]:text-[var(--color-text)]"
                data-active={candidate === section}
              >
                {candidate === "appearance" ? t("appearance") : candidate === "menuBar" ? t("menuBar") : t("alerts")}
              </button>
            ))}
          </nav>

          <div className="min-h-0 overflow-hidden p-4">
            {section === "appearance" ? (
              <div className="grid gap-4 font-mono text-xs">
                <SettingsGroup title={t("theme")}>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {themePresets.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setTheme(theme.id as ThemeId)}
                        className="grid min-h-16 content-between rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-3 text-left text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-row-hover)] data-[active=true]:border-[var(--color-accent)] data-[active=true]:text-[var(--color-text)] data-[active=true]:shadow-[var(--shadow-glow)]"
                        data-active={theme.id === themeId}
                      >
                        <span>{theme.name}</span>
                        <span className="mt-3 flex gap-1">
                          {theme.chart.barSteps.slice(1, 5).map((color) => (
                            <span
                              key={color}
                              className="h-1.5 flex-1 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </span>
                      </button>
                    ))}
                  </div>
                </SettingsGroup>

                <SettingsGroup title={t("language")}>
                  <div className="inline-flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-1">
                    {(Object.keys(localeNames) as Locale[]).map((candidate) => (
                      <button
                        key={candidate}
                        type="button"
                        onClick={() => setLocale(candidate)}
                        className="h-8 rounded-[var(--radius-control)] px-3 font-mono text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-row-hover)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-text)]"
                        data-active={candidate === locale}
                      >
                        {localeNames[candidate]}
                      </button>
                    ))}
                  </div>
                </SettingsGroup>
              </div>
            ) : section === "menuBar" ? (
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 font-mono text-xs">
                <div className="text-[var(--color-text-muted)]">{t("menuBarSettingsHint")}</div>

                <div className="scrollbar-none grid min-h-0 content-start gap-2 overflow-auto pr-1">
                  {hosts.length === 0 ? (
                    <InfoBlock title={t("hosts")} text={t("noHosts")} muted />
                  ) : (
                    hosts.map((host) => {
                      const item = trayItemsByHost.get(host.id);
                      const enabled = Boolean(item);
                      const displayMode = item?.displayMode ?? "text";
                      const label = item?.label ?? defaultTrayLabel(host);

                      return (
                        <section
                          key={host.id}
                          className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-3 sm:grid-cols-[minmax(0,1fr)_112px_144px] sm:items-center"
                        >
                          <label className="flex min-w-0 items-start gap-2">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(event) => setTrayHostEnabled(host, event.currentTarget.checked)}
                              className="mt-0.5 accent-[var(--color-accent)]"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[var(--color-text)]">{host.name}</span>
                              <span className="block truncate text-[var(--color-text-muted)]">
                                {host.auth.username}@{host.address}:{host.port}
                              </span>
                            </span>
                          </label>

                          <input
                            value={label}
                            disabled={!enabled}
                            maxLength={12}
                            onChange={(event) => setTrayLabel(host, event.currentTarget.value)}
                            className="h-8 min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] px-2 text-[var(--color-text)] outline-none focus:border-[var(--color-border-strong)] disabled:text-[var(--color-text-muted)]"
                            aria-label={t("menuBarName")}
                          />

                          <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] p-1">
                            {(["text", "rings"] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                disabled={!enabled}
                                onClick={() => setTrayDisplayMode(host, mode)}
                                className="h-6 flex-1 rounded-[var(--radius-control)] px-2 text-[11px] text-[var(--color-text-muted)] disabled:opacity-40 data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-text)]"
                                data-active={displayMode === mode}
                              >
                                {mode === "text" ? t("textMode") : t("ringsMode")}
                              </button>
                            ))}
                          </div>
                        </section>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                  <div className="min-w-0 truncate text-[var(--color-danger)]">
                    {traySettingsError ? traySettingsError.message : ""}
                  </div>
                  <button type="button" onClick={onSaveTraySettings} className="control-button" disabled={isSavingTraySettings}>
                    {isSavingTraySettings ? t("saving") : t("save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 font-mono text-xs">
                <div className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="text-[var(--color-text)]">{t("alertNotifications")}</div>
                    <div className="mt-1 text-[var(--color-text-muted)]">
                      {t("alertSettingsHint")}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] px-2 py-1 text-[11px] text-[var(--color-text-muted)]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: alertPermission === "granted" ? "var(--color-cpu)" : "var(--color-warning)" }} />
                      {t("notificationPermission")}: {t(alertPermission === "granted" ? "permissionGranted" : alertPermission === "denied" ? "permissionDenied" : "permissionPrompt")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void requestAlertPermission()}
                    className="control-button"
                    disabled={isRequestingAlertPermission || alertPermission === "granted"}
                  >
                    {isRequestingAlertPermission ? t("requesting") : t("enableNotifications")}
                  </button>
                </div>

                <div className="scrollbar-none grid min-h-0 content-start gap-2 overflow-auto pr-1">
                  {hosts.length === 0 ? (
                    <InfoBlock title={t("hosts")} text={t("noHosts")} muted />
                  ) : (
                    hosts.map((host) => {
                      const rule = alertRulesByHost.get(host.id) ?? createCpuAlertRule(host.id);
                      const enabled = Boolean(alertRulesByHost.get(host.id)?.enabled);

                      return (
                        <section
                          key={host.id}
                          className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-3 sm:grid-cols-[minmax(0,1fr)_120px_124px] sm:items-center"
                        >
                          <label className="flex min-w-0 items-start gap-2">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(event) => setAlertHostEnabled(host, event.currentTarget.checked)}
                              className="mt-0.5 accent-[var(--color-accent)]"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-[var(--color-text)]">{host.name}</span>
                              <span className="block truncate text-[var(--color-text-muted)]">
                                {t("cpu")} {" >= "} {Math.round(rule.thresholdPercent)}%
                              </span>
                            </span>
                          </label>

                          <label className="grid gap-1">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">{t("threshold")}</span>
                            <div className="flex h-8 items-center rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] px-2">
                              <input
                                value={Math.round(rule.thresholdPercent)}
                                disabled={!enabled}
                                type="number"
                                min={1}
                                max={100}
                                onChange={(event) => setAlertThreshold(host, Number(event.currentTarget.value))}
                                className="min-w-0 flex-1 bg-transparent text-[var(--color-text)] outline-none disabled:text-[var(--color-text-muted)]"
                                aria-label={t("threshold")}
                              />
                              <span className="text-[var(--color-text-muted)]">%</span>
                            </div>
                          </label>

                          <label className="grid gap-1">
                            <span className="text-[10px] uppercase text-[var(--color-text-muted)]">{t("cooldown")}</span>
                            <select
                              value={rule.cooldownMs}
                              disabled={!enabled}
                              onChange={(event) => setAlertCooldown(host, Number(event.currentTarget.value))}
                              className="h-8 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] px-2 text-[var(--color-text)] outline-none focus:border-[var(--color-border-strong)] disabled:text-[var(--color-text-muted)]"
                              aria-label={t("cooldown")}
                            >
                              {alertCooldownOptions.map((cooldownMs) => (
                                <option key={cooldownMs} value={cooldownMs}>
                                  {cooldownMs / 60_000}m
                                </option>
                              ))}
                            </select>
                          </label>
                        </section>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                  <div className="min-w-0 truncate text-[var(--color-danger)]">
                    {alertSettingsError ? alertSettingsError.message : ""}
                  </div>
                  <button type="button" onClick={onSaveAlertSettings} className="control-button" disabled={isSavingAlertSettings}>
                    {isSavingAlertSettings ? t("saving") : t("save")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-[11px] uppercase text-[var(--color-text-muted)]">{title}</h3>
      {children}
    </section>
  );
}

function InfoBlock({ title, text, muted = false }: { title: string; text: string; muted?: boolean }) {
  return (
    <section className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-3">
      <div className="text-[var(--color-text-muted)]">{title}</div>
      <div className={muted ? "mt-1 text-[var(--color-text-muted)]" : "mt-1 text-[var(--color-text)]"}>{text}</div>
    </section>
  );
}
