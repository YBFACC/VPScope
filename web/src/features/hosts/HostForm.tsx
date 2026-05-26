import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { runClient, tauriClient } from "@/lib/tauriClient";
import { useHostStore } from "@/stores/hostStore";
import type { HostAuth, HostCreatePayload, SshConfigHost } from "@/types/contracts";

const inputClass =
  "h-8 min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 font-mono text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-border-strong)]";

type HostFormProps = {
  open: boolean;
  onClose: () => void;
};

export function HostForm({ open, onClose }: HostFormProps) {
  const hosts = useHostStore((state) => state.hosts);
  const createHost = useHostStore((state) => state.createHost);
  const testConnection = useHostStore((state) => state.testConnection);
  const { t } = useI18n();
  const [mode, setMode] = useState<"manual" | "sshConfig">("manual");
  const [sshConfigHosts, setSshConfigHosts] = useState<SshConfigHost[]>([]);
  const [selectedConfigAlias, setSelectedConfigAlias] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [port, setPort] = useState(22);
  const [authType, setAuthType] = useState<HostAuth["type"]>("ssh_agent");
  const [keyPath, setKeyPath] = useState("~/.ssh/id_ed25519");
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(2_000);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!open) {
      return;
    }

    setMessage(undefined);
    void runClient(() => tauriClient.listSshConfigHosts()).then((items) => {
      setSshConfigHosts(items);
    });
  }, [open]);

  useEffect(() => {
    if (mode !== "sshConfig" || selectedConfigAlias || !sshConfigHosts[0]) {
      return;
    }

    applySshConfigHostFromItem(sshConfigHosts[0]);
  }, [mode, selectedConfigAlias, sshConfigHosts]);

  const payload = (): HostCreatePayload => ({
    name: name.trim(),
    address: address.trim(),
    port,
    refreshIntervalMs,
    tags: ["ssh"],
    auth:
      authType === "private_key"
        ? { type: "private_key", username: username.trim(), keyPath }
        : authType === "password"
          ? { type: "password", username: username.trim() }
          : { type: "ssh_agent", username: username.trim() },
  });

  function applySshConfigHost(alias: string) {
    const item = sshConfigHosts.find((host) => host.alias === alias);

    if (!item) {
      return;
    }

    applySshConfigHostFromItem(item);
  }

  function applySshConfigHostFromItem(item: SshConfigHost) {
    setSelectedConfigAlias(item.alias);
    setName(item.alias);
    setAddress(item.alias);
    setUsername(item.user ?? "");
    setPort(item.port);
    setAuthType("ssh_agent");
    setKeyPath(item.identityFile ?? "");
  }

  async function onTest() {
    setMessage(t("testing"));
    await testConnection({ draft: payload() });
    setMessage(t("connectionTestFinished"));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim() || !address.trim() || !username.trim()) {
      setMessage(t("configRequired"));
      return;
    }

    if (
      hosts.some(
        (host) =>
          host.address === address.trim() &&
          host.port === port &&
          host.auth.username === username.trim(),
      )
    ) {
      setMessage(t("hostAlreadyExists"));
      return;
    }

    setIsSaving(true);
    try {
      await createHost(payload());
      setMessage(t("hostSaved"));
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--color-overlay)] p-4 backdrop-blur-sm">
      <form
        onSubmit={onSubmit}
        className="grid w-full max-w-xl gap-3 rounded-[var(--radius-panel)] border border-[var(--color-border-strong)] bg-[var(--color-panel-glass)] p-4 shadow-[var(--shadow-panel)] backdrop-blur"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-mono text-base font-semibold text-[var(--color-text)]">
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)] shadow-[var(--shadow-glow)]" />
            {t("addHost")}
          </h2>
          <button type="button" onClick={onClose} className="control-button">
            {t("close")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-1">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="h-8 rounded-[var(--radius-control)] font-mono text-xs text-[var(--color-text-muted)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-text)]"
            data-active={mode === "manual"}
          >
            {t("manual")}
          </button>
          <button
            type="button"
            onClick={() => setMode("sshConfig")}
            className="h-8 rounded-[var(--radius-control)] font-mono text-xs text-[var(--color-text-muted)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-text)]"
            data-active={mode === "sshConfig"}
          >
            {t("importFromSshConfig")}
          </button>
        </div>

        {mode === "sshConfig" ? (
          <div className="grid gap-2">
            {sshConfigHosts.length === 0 ? (
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] p-3 font-mono text-xs text-[var(--color-text-muted)]">
                {t("noSshConfigHosts")}
              </div>
            ) : (
              <select className={inputClass} value={selectedConfigAlias} onChange={(event) => applySshConfigHost(event.target.value)}>
                {sshConfigHosts.map((host) => (
                  <option key={host.alias} value={host.alias}>
                    {host.alias} - {host.user ?? "?"}@{host.hostName}:{host.port}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : null}

        <div className="grid min-w-0 grid-cols-2 gap-2">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} aria-label={t("hostName")} placeholder={t("hostName")} />
          <input className={inputClass} value={address} onChange={(event) => setAddress(event.target.value)} aria-label={t("address")} placeholder={t("address")} />
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_96px_minmax(104px,136px)] gap-2">
          <input className={inputClass} value={username} onChange={(event) => setUsername(event.target.value)} aria-label={t("user")} placeholder={t("user")} />
          <input className={inputClass} value={port} min={1} max={65535} type="number" onChange={(event) => setPort(Number(event.target.value))} aria-label={t("port")} />
          <select className={inputClass} value={authType} onChange={(event) => setAuthType(event.target.value as HostAuth["type"])}>
            <option value="ssh_agent">{t("authAgent")}</option>
            <option value="private_key">{t("authKey")}</option>
            <option value="password">{t("authPassword")}</option>
          </select>
        </div>
        {authType === "private_key" ? (
          <input className={inputClass} value={keyPath} onChange={(event) => setKeyPath(event.target.value)} aria-label={t("identityFile")} placeholder={t("identityFile")} />
        ) : null}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
          <select
            className={inputClass}
            value={refreshIntervalMs}
            onChange={(event) => setRefreshIntervalMs(Number(event.target.value))}
            aria-label="Refresh interval"
          >
            <option value={1000}>1000ms</option>
            <option value={2000}>2000ms</option>
            <option value={5000}>5000ms</option>
          </select>
          <button type="button" onClick={onTest} className="control-button min-w-0 px-3">
            {t("test")}
          </button>
          <button type="submit" className="control-button min-w-0 px-3" disabled={isSaving}>
            {t("save")}
          </button>
        </div>
        {message ? <p className="truncate font-mono text-[11px] text-[var(--color-text-muted)]">{message}</p> : null}
      </form>
    </div>
  );
}
