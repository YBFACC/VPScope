import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { runClient, tauriClient } from "@/lib/tauriClient";
import { useHostStore } from "@/stores/hostStore";
import type { HostAuth, HostCreatePayload, SshConfigHost } from "@/types/contracts";

const inputClass =
  "h-8 min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] px-2 font-mono text-[11px] uppercase text-[var(--color-text)] outline-none focus:border-[var(--color-border-strong)]";

type HostFormProps = {
  open: boolean;
  onClose: () => void;
};

export function HostForm({ open, onClose }: HostFormProps) {
  const hosts = useHostStore((state) => state.hosts);
  const createHost = useHostStore((state) => state.createHost);
  const testConnection = useHostStore((state) => state.testConnection);
  const { t } = useI18n();
  const [mode, setMode] = useState<"manual" | "sshConfig">("sshConfig");
  const [sshConfigHosts, setSshConfigHosts] = useState<SshConfigHost[]>([]);
  const [isLoadingSshConfig, setIsLoadingSshConfig] = useState(false);
  const [selectedConfigAlias, setSelectedConfigAlias] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [username, setUsername] = useState("");
  const [port, setPort] = useState(22);
  const [authType, setAuthType] = useState<HostAuth["type"]>("ssh_agent");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("~/.ssh/id_ed25519");
  const [passphrase, setPassphrase] = useState("");
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(2_000);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const selectedConfigHost = sshConfigHosts.find((host) => host.alias === selectedConfigAlias);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMode("sshConfig");
    setSelectedConfigAlias("");
    setName("");
    setAddress("");
    setUsername("");
    setPort(22);
    setAuthType("ssh_agent");
    setPassword("");
    setKeyPath("~/.ssh/id_ed25519");
    setPassphrase("");
    setRefreshIntervalMs(2_000);
    setSshConfigHosts([]);
    setIsLoadingSshConfig(true);
    setMessage(undefined);

    let active = true;
    void runClient(() => tauriClient.listSshConfigHosts())
      .then((items) => {
        if (active) {
          setSshConfigHosts(items);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingSshConfig(false);
        }
      });

    return () => {
      active = false;
    };
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
        ? {
            type: "private_key",
            username: username.trim(),
            keyPath,
            passphrase: passphrase || undefined,
          }
        : authType === "password"
          ? {
              type: "password",
              username: username.trim(),
              password: password || undefined,
            }
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
    setPassword("");
    setKeyPath(item.identityFile ?? "");
    setPassphrase("");
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
    <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--color-overlay)] p-4">
      <form
        onSubmit={onSubmit}
        className="grid w-full max-w-xl gap-3 rounded-[var(--radius-panel)] border border-[var(--color-border-strong)] bg-[var(--color-panel-glass)] p-3 font-mono shadow-[var(--shadow-panel)]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase text-[var(--color-text)]">
            <span className="pixel-dot mr-2 text-[var(--color-accent)]" />
            {t("addHost")}
          </h2>
          <button type="button" onClick={onClose} className="control-button">
            {t("close")}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-1">
          <button
            type="button"
            onClick={() => setMode("sshConfig")}
            className="h-8 rounded-[var(--radius-control)] border border-transparent text-[11px] uppercase text-[var(--color-text-muted)] data-[active=true]:border-[var(--color-border-strong)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-accent)]"
            data-active={mode === "sshConfig"}
          >
            {t("importFromSshConfig")}
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className="h-8 rounded-[var(--radius-control)] border border-transparent text-[11px] uppercase text-[var(--color-text-muted)] data-[active=true]:border-[var(--color-border-strong)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-accent)]"
            data-active={mode === "manual"}
          >
            {t("advancedManual")}
          </button>
        </div>

        {mode === "sshConfig" ? (
          <div className="grid gap-2">
            <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] p-2">
              <p className="text-[11px] uppercase text-[var(--color-text)]">{t("sshConfigProfileLead")}</p>
              <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">{t("sshConfigProfileHint")}</p>
            </div>
            {isLoadingSshConfig ? (
              <div className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-3 text-xs uppercase text-[var(--color-text-muted)]">
                {t("readingSshConfig")}
              </div>
            ) : sshConfigHosts.length === 0 ? (
              <div className="grid gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-input)] p-3 text-xs text-[var(--color-text-muted)]">
                <span>{t("noSshConfigHosts")}</span>
                <span className="text-[11px] leading-4">{t("noSshConfigHostsMessage")}</span>
                <button type="button" onClick={() => setMode("manual")} className="control-button justify-self-start">
                  {t("advancedManual")}
                </button>
              </div>
            ) : (
              <div className="grid max-h-44 gap-1 overflow-auto pr-1">
                {sshConfigHosts.map((host) => (
                  <button
                    key={host.alias}
                    type="button"
                    onClick={() => applySshConfigHost(host.alias)}
                    className="grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-input)] px-2 py-1 text-left text-[11px] uppercase text-[var(--color-text-muted)] data-[active=true]:border-[var(--color-border-strong)] data-[active=true]:bg-[var(--color-panel-muted)] data-[active=true]:text-[var(--color-text)]"
                    data-active={selectedConfigAlias === host.alias}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[var(--color-accent)]">{host.alias}</span>
                      <span className="block truncate">
                        {host.user ?? t("userRequiredBeforeSave")}@{host.hostName}:{host.port}
                      </span>
                    </span>
                    <span className="max-w-36 truncate text-right text-[10px] text-[var(--color-text-muted)]">
                      {host.identityFile ?? t("authAgent")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {selectedConfigHost ? (
              <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] p-2 text-[11px] uppercase text-[var(--color-text-muted)]">
                <span className="truncate">
                  {t("profileAlias")}: <span className="text-[var(--color-text)]">{selectedConfigHost.alias}</span>
                </span>
                <span className="truncate">
                  {t("profileAddress")}: <span className="text-[var(--color-text)]">{selectedConfigHost.alias}</span>
                </span>
                <span className="truncate">
                  {t("profileUser")}:{" "}
                  <span className="text-[var(--color-text)]">{selectedConfigHost.user ?? t("fillBeforeSave")}</span>
                </span>
                <span className="truncate">
                  {t("profileAuth")}: <span className="text-[var(--color-text)]">{t("authAgent")}</span>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "manual" ? (
          <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-panel)] p-2">
            <p className="text-[11px] uppercase text-[var(--color-text)]">{t("advancedManualLead")}</p>
            <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">{t("advancedManualHint")}</p>
          </div>
        ) : null}

        <div className="grid min-w-0 grid-cols-2 gap-2">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} aria-label={t("hostName")} placeholder={t("hostName")} />
          <input className={inputClass} value={address} onChange={(event) => setAddress(event.target.value)} aria-label={t("address")} placeholder={t("address")} />
        </div>
        {mode === "sshConfig" ? (
          <p className="truncate text-[10px] uppercase text-[var(--color-text-muted)]">{t("sshConfigAddressAliasHint")}</p>
        ) : null}
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
          <div className="grid gap-1">
            <div className="grid min-w-0 grid-cols-2 gap-2">
              <input className={inputClass} value={keyPath} onChange={(event) => setKeyPath(event.target.value)} aria-label={t("identityFile")} placeholder={t("identityFile")} />
              <input className={inputClass} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} aria-label={t("passphrase")} placeholder={t("passphrase")} type="password" autoComplete="new-password" />
            </div>
            <p className="truncate text-[10px] uppercase text-[var(--color-text-muted)]">{t("keychainPassphraseHint")}</p>
          </div>
        ) : null}
        {authType === "password" ? (
          <div className="grid gap-1">
            <input className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} aria-label={t("password")} placeholder={t("password")} type="password" autoComplete="new-password" />
            <p className="truncate text-[10px] uppercase text-[var(--color-text-muted)]">{t("keychainPasswordHint")}</p>
          </div>
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
            {t("saveSshProfile")}
          </button>
        </div>
        {message ? <p className="truncate text-[11px] uppercase text-[var(--color-text-muted)]">{message}</p> : null}
      </form>
    </div>
  );
}
