import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { XIcon } from "@/features/hosts/HostActionIcons";
import { useI18n } from "@/i18n/useI18n";
import { formatDateTime } from "@/lib/format";
import { runClient, tauriClient } from "@/lib/tauriClient";
import type {
  AppError,
  DockerContainer,
  DockerContainerLogsResult,
  DockerLogTailLines,
  HostConfig,
} from "@/types/contracts";

const tailOptions: DockerLogTailLines[] = [100, 300, 1000];
const autoRefreshOptions = [0, 1_000, 3_000, 5_000] as const;

type AutoRefreshMs = (typeof autoRefreshOptions)[number];

type DockerLogsWorkspaceProps = {
  host: HostConfig;
  onClose: () => void;
};

export function DockerLogsWorkspace({ host, onClose }: DockerLogsWorkspaceProps) {
  const { t } = useI18n();
  const logOutputRef = useRef<HTMLPreElement>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string>();
  const [logsResult, setLogsResult] = useState<DockerContainerLogsResult>();
  const [tailLines, setTailLines] = useState<DockerLogTailLines>(300);
  const [autoRefreshMs, setAutoRefreshMs] = useState<AutoRefreshMs>(0);
  const [search, setSearch] = useState("");
  const [isLoadingContainers, setIsLoadingContainers] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [containerError, setContainerError] = useState<AppError>();
  const [logsError, setLogsError] = useState<AppError>();
  const selectedContainer = containers.find((container) => container.id === selectedContainerId);

  const searchNeedle = search.trim();
  const visibleLogLines = useMemo(() => {
    const logs = logsResult?.logs ?? "";
    const needle = searchNeedle.toLowerCase();
    if (!needle) {
      return logs ? logs.split("\n") : [];
    }

    return logs
      .split("\n")
      .filter((line) => line.toLowerCase().includes(needle));
  }, [logsResult?.logs, searchNeedle]);

  const loadLogs = useCallback(
    async (containerId: string, nextTailLines = tailLines) => {
      setIsLoadingLogs(true);
      setLogsError(undefined);
      try {
        const result = await runClient(() =>
          tauriClient.getDockerContainerLogs({
            hostId: host.id,
            containerId,
            tailLines: nextTailLines,
          }),
        );
        setLogsResult(result);
      } catch (error) {
        setLogsResult(undefined);
        setLogsError(error as AppError);
      } finally {
        setIsLoadingLogs(false);
      }
    },
    [host.id, tailLines],
  );

  const loadContainers = useCallback(async () => {
    setIsLoadingContainers(true);
    setContainerError(undefined);
    try {
      const nextContainers = await runClient(() => tauriClient.listDockerContainers(host.id));
      setContainers(nextContainers);

      const nextSelected =
        nextContainers.find((container) => container.id === selectedContainerId)?.id ?? nextContainers[0]?.id;
      setSelectedContainerId(nextSelected);

      if (nextSelected) {
        await loadLogs(nextSelected);
      } else {
        setLogsResult(undefined);
        setLogsError(undefined);
      }
    } catch (error) {
      setContainers([]);
      setLogsResult(undefined);
      setContainerError(error as AppError);
    } finally {
      setIsLoadingContainers(false);
    }
  }, [host.id, loadLogs, selectedContainerId]);

  useEffect(() => {
    void loadContainers();
  }, [loadContainers]);

  useEffect(() => {
    if (!autoRefreshMs || !selectedContainerId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (!isLoadingLogs) {
        void loadLogs(selectedContainerId);
      }
    }, autoRefreshMs);

    return () => window.clearInterval(intervalId);
  }, [autoRefreshMs, isLoadingLogs, loadLogs, selectedContainerId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const output = logOutputRef.current;
      if (output) {
        output.scrollTop = output.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [logsResult?.fetchedAt, selectedContainerId, tailLines, visibleLogLines.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function selectContainer(container: DockerContainer) {
    setSelectedContainerId(container.id);
    await loadLogs(container.id);
  }

  async function selectTailLines(nextTailLines: DockerLogTailLines) {
    setTailLines(nextTailLines);
    if (selectedContainerId) {
      await loadLogs(selectedContainerId, nextTailLines);
    }
  }

  const logLineCount = visibleLogLines.length;

  return (
    <div className="docker-workspace-overlay">
      <section className="docker-workspace" aria-label={t("dockerLogs")}>
        <header className="docker-workspace-header">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold uppercase text-[var(--color-text)]">
              <span className="text-[var(--color-accent)]">Docker</span> {t("logs")}
            </h2>
            <p className="truncate text-[10px] uppercase text-[var(--color-text-muted)]">
              {host.name} · {host.auth.username}@{host.address}:{host.port}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
            <div className="docker-tail-switch">
              {tailOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => void selectTailLines(option)}
                  data-active={option === tailLines}
                  disabled={isLoadingLogs}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="docker-refresh-switch" aria-label={t("autoRefresh")}>
              {autoRefreshOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAutoRefreshMs(option)}
                  data-active={option === autoRefreshMs}
                  title={t("autoRefresh")}
                >
                  {option === 0 ? t("off") : t("secondsShort", { count: option / 1_000 })}
                </button>
              ))}
            </div>
            <button type="button" className="control-button docker-manual-refresh-button" onClick={() => void loadContainers()}>
              {isLoadingContainers || isLoadingLogs ? t("refreshing") : t("refresh")}
            </button>
            <button
              type="button"
              className="control-button icon-button grid h-7 w-7 place-items-center"
              onClick={onClose}
              title={t("close")}
              aria-label={t("close")}
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="docker-workspace-body">
          <aside className="docker-container-pane">
            <div className="docker-pane-title">
              <span>{t("containers")}</span>
              <span>{containers.length}</span>
            </div>
            {containerError ? (
              <ErrorBlock title={containerError.code} message={containerError.message} detail={containerError.detail} />
            ) : isLoadingContainers && containers.length === 0 ? (
              <div className="docker-empty">{t("loadingContainers")}</div>
            ) : containers.length === 0 ? (
              <div className="docker-empty">{t("noDockerContainers")}</div>
            ) : (
              <div className="docker-container-list">
                {containers.map((container) => {
                  const isRunning = container.state.toLowerCase() === "running";
                  return (
                    <button
                      key={container.id}
                      type="button"
                      onClick={() => void selectContainer(container)}
                      className="docker-container-row"
                      data-active={container.id === selectedContainerId}
                    >
                      <span
                        className={clsx("docker-status-dot", isRunning ? "docker-status-dot-running" : "docker-status-dot-muted")}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[var(--color-text)]">{container.name}</span>
                        <span className="block truncate text-[10px] text-[var(--color-text-muted)]">{container.image}</span>
                      </span>
                      <span className="truncate text-right text-[10px] uppercase text-[var(--color-text-muted)]">
                        {container.state}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="docker-log-pane">
            <div className="docker-log-toolbar">
              <div className="min-w-0">
                <div className="truncate text-xs uppercase text-[var(--color-text)]">
                  {selectedContainer?.name ?? t("noContainerSelected")}
                </div>
                <div className="truncate text-[10px] uppercase text-[var(--color-text-muted)]">
                  {logsResult ? `${t("last")} ${tailLines} · ${formatDateTime(logsResult.fetchedAt)}` : selectedContainer?.status}
                </div>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="docker-log-search"
                placeholder={t("searchLogs")}
                aria-label={t("searchLogs")}
              />
            </div>

            {logsError ? (
              <ErrorBlock title={logsError.code} message={logsError.message} detail={logsError.detail} />
            ) : isLoadingLogs && !logsResult ? (
              <div className="docker-empty">{t("loadingLogs")}</div>
            ) : selectedContainer ? (
              <pre ref={logOutputRef} className="docker-log-output">
                {visibleLogLines.length > 0
                  ? visibleLogLines.map((line, index) => (
                      <LogLine key={`${index}-${line}`} line={line} needle={searchNeedle} isLast={index === visibleLogLines.length - 1} />
                    ))
                  : t("emptyDockerLogs")}
              </pre>
            ) : (
              <div className="docker-empty">{t("noContainerSelected")}</div>
            )}

            <footer className="docker-log-footer">
              <span>{selectedContainer?.id ?? "--"}</span>
              <span>{t("rows", { count: logLineCount })}</span>
            </footer>
          </section>
        </div>
      </section>
    </div>
  );
}

function LogLine({ line, needle, isLast }: { line: string; needle: string; isLast: boolean }) {
  const trimmedNeedle = needle.trim();
  if (!trimmedNeedle) {
    return (
      <span>
        {line}
        {isLast ? null : "\n"}
      </span>
    );
  }

  const parts = splitLogLineByNeedle(line, trimmedNeedle);
  return (
    <span>
      {parts.map((part, index) =>
        part.isMatch ? (
          <mark key={`${index}-${part.text}`} className="docker-log-match">
            {part.text}
          </mark>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        ),
      )}
      {isLast ? null : "\n"}
    </span>
  );
}

function splitLogLineByNeedle(line: string, needle: string) {
  const parts: Array<{ text: string; isMatch: boolean }> = [];
  const lowerLine = line.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let cursor = 0;

  while (cursor < line.length) {
    const matchIndex = lowerLine.indexOf(lowerNeedle, cursor);
    if (matchIndex === -1) {
      parts.push({ text: line.slice(cursor), isMatch: false });
      break;
    }

    if (matchIndex > cursor) {
      parts.push({ text: line.slice(cursor, matchIndex), isMatch: false });
    }
    parts.push({ text: line.slice(matchIndex, matchIndex + needle.length), isMatch: true });
    cursor = matchIndex + needle.length;
  }

  return parts;
}

function ErrorBlock({ title, message, detail }: { title: string; message: string; detail?: string }) {
  return (
    <div className="docker-error">
      <strong>{title}</strong>
      <span>{message}</span>
      {detail ? <code>{detail}</code> : null}
    </div>
  );
}
