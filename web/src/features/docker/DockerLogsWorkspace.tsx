import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { XIcon } from "@/features/hosts/HostActionIcons";
import { useI18n } from "@/i18n/useI18n";
import { formatDateTime } from "@/lib/format";
import { runClient, tauriClient } from "@/lib/tauriClient";
import type {
  AppError,
  DockerComposeAction,
  DockerContainer,
  DockerContainerAction,
  DockerContainerLogsResult,
  DockerLogTailLines,
  HostConfig,
} from "@/types/contracts";

const tailOptions: DockerLogTailLines[] = [100, 300, 1000];
const autoRefreshOptions = [0, 1_000, 3_000, 5_000] as const;

type AutoRefreshMs = (typeof autoRefreshOptions)[number];
type DockerContainerGroup = {
  id: string;
  label: string;
  composeProject?: string;
  composeContainer?: DockerContainer;
  containers: DockerContainer[];
};

type DockerLogsWorkspaceProps = {
  host: HostConfig;
  onClose: () => void;
};

export function DockerLogsWorkspace({ host, onClose }: DockerLogsWorkspaceProps) {
  const { t } = useI18n();
  const logOutputRef = useRef<HTMLPreElement>(null);
  const selectedContainerIdRef = useRef<string | undefined>(undefined);
  const selectedComposeProjectRef = useRef<string | undefined>(undefined);
  const tailLinesRef = useRef<DockerLogTailLines>(300);
  const logRequestIdRef = useRef(0);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string>();
  const [selectedComposeProject, setSelectedComposeProject] = useState<string>();
  const [logsResult, setLogsResult] = useState<DockerContainerLogsResult>();
  const [tailLines, setTailLines] = useState<DockerLogTailLines>(300);
  const [autoRefreshMs, setAutoRefreshMs] = useState<AutoRefreshMs>(0);
  const [search, setSearch] = useState("");
  const [isLoadingContainers, setIsLoadingContainers] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [pendingAction, setPendingAction] = useState<DockerContainerAction>();
  const [pendingComposeAction, setPendingComposeAction] = useState<DockerComposeAction>();
  const [confirmRemoveContainer, setConfirmRemoveContainer] = useState<DockerContainer>();
  const [confirmComposeProjectContainer, setConfirmComposeProjectContainer] = useState<DockerContainer>();
  const [containerError, setContainerError] = useState<AppError>();
  const [logsError, setLogsError] = useState<AppError>();
  const [actionError, setActionError] = useState<AppError>();
  const selectedContainer = containers.find((container) => container.id === selectedContainerId);
  const selectedContainerIsRunning = isContainerRunning(selectedContainer);

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

  const standaloneContainersLabel = t("standaloneContainers");
  const containerGroups = useMemo(
    () => groupDockerContainers(containers, standaloneContainersLabel),
    [containers, standaloneContainersLabel],
  );
  const selectedComposeGroup = selectedComposeProject
    ? containerGroups.find((group) => group.composeProject === selectedComposeProject)
    : undefined;
  const composeActionContainer = selectedComposeGroup?.composeContainer;
  const logTitle = selectedComposeGroup
    ? `${t("compose")} ${selectedComposeGroup.label}`
    : (selectedContainer?.name ?? t("noContainerSelected"));
  const logSubtitle = logsResult
    ? `${t("last")} ${tailLines} · ${formatDateTime(logsResult.fetchedAt)}`
    : selectedComposeGroup
      ? `${selectedComposeGroup.containers.length} ${t("containers")}`
      : selectedContainer?.status;

  const loadLogs = useCallback(
    async (containerId: string, nextTailLines = tailLinesRef.current) => {
      const requestId = logRequestIdRef.current + 1;
      logRequestIdRef.current = requestId;
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
        if (requestId !== logRequestIdRef.current) {
          return;
        }
        if (!selectedComposeProjectRef.current && selectedContainerIdRef.current === containerId) {
          setSelectedComposeProject(undefined);
          setSelectedContainerId(containerId);
        }
        setLogsResult(result);
      } catch (error) {
        if (requestId !== logRequestIdRef.current) {
          return;
        }
        setLogsResult(undefined);
        setLogsError(error as AppError);
      } finally {
        if (requestId === logRequestIdRef.current) {
          setIsLoadingLogs(false);
        }
      }
    },
    [host.id],
  );

  const loadComposeLogs = useCallback(
    async (group: DockerContainerGroup, nextTailLines = tailLinesRef.current) => {
      const requestId = logRequestIdRef.current + 1;
      logRequestIdRef.current = requestId;
      setIsLoadingLogs(true);
      setLogsError(undefined);
      try {
        const results = await Promise.all(
          group.containers.map((container) =>
            runClient(() =>
              tauriClient.getDockerContainerLogs({
                hostId: host.id,
                containerId: container.id,
                tailLines: nextTailLines,
              }),
            ).then((result) => ({ container, result })),
          ),
        );
        if (requestId !== logRequestIdRef.current) {
          return;
        }
        if (group.composeProject && selectedComposeProjectRef.current === group.composeProject) {
          setSelectedComposeProject(group.composeProject);
          setSelectedContainerId(undefined);
        }

        const logs = results
          .map(({ container, result }) => `===== ${container.name} =====\n${result.logs}`)
          .join("\n");
        const fetchedAt = Math.max(...results.map(({ result }) => result.fetchedAt), Date.now());
        setLogsResult({
          hostId: host.id,
          containerId: group.id,
          tailLines: nextTailLines,
          logs,
          fetchedAt,
        });
      } catch (error) {
        if (requestId !== logRequestIdRef.current) {
          return;
        }
        setLogsResult(undefined);
        setLogsError(error as AppError);
      } finally {
        if (requestId === logRequestIdRef.current) {
          setIsLoadingLogs(false);
        }
      }
    },
    [host.id],
  );

  const loadContainers = useCallback(async () => {
    setIsLoadingContainers(true);
    setContainerError(undefined);
    try {
      const nextContainers = await runClient(() => tauriClient.listDockerContainers(host.id));
      setContainers(nextContainers);

      const nextGroups = groupDockerContainers(nextContainers, "standalone");
      const selectedComposeProjectId = selectedComposeProjectRef.current;
      const nextComposeGroup = selectedComposeProjectId
        ? nextGroups.find((group) => group.composeProject === selectedComposeProjectId)
        : undefined;
      if (nextComposeGroup) {
        selectedComposeProjectRef.current = nextComposeGroup.composeProject;
        selectedContainerIdRef.current = undefined;
        setSelectedComposeProject(nextComposeGroup.composeProject);
        setSelectedContainerId(undefined);
        await loadComposeLogs(nextComposeGroup);
        return;
      }

      const nextSelected =
        nextContainers.find((container) => container.id === selectedContainerIdRef.current)?.id ?? nextContainers[0]?.id;
      selectedComposeProjectRef.current = undefined;
      selectedContainerIdRef.current = nextSelected;
      setSelectedComposeProject(undefined);
      setSelectedContainerId(nextSelected);

      if (nextSelected) {
        await loadLogs(nextSelected);
      } else {
        logRequestIdRef.current += 1;
        setLogsResult(undefined);
        setLogsError(undefined);
      }
    } catch (error) {
      logRequestIdRef.current += 1;
      setContainers([]);
      setLogsResult(undefined);
      setContainerError(error as AppError);
    } finally {
      setIsLoadingContainers(false);
    }
  }, [host.id, loadComposeLogs, loadLogs]);

  useEffect(() => {
    void loadContainers();
  }, [loadContainers]);

  useEffect(() => {
    if (!autoRefreshMs || (!selectedContainerId && !selectedComposeGroup)) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      if (!isLoadingLogs) {
        if (selectedComposeGroup) {
          void loadComposeLogs(selectedComposeGroup);
        } else if (selectedContainerId) {
          void loadLogs(selectedContainerId);
        }
      }
    }, autoRefreshMs);

    return () => window.clearInterval(intervalId);
  }, [autoRefreshMs, isLoadingLogs, loadComposeLogs, loadLogs, selectedComposeGroup, selectedContainerId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const output = logOutputRef.current;
      if (output) {
        output.scrollTop = output.scrollHeight;
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [logsResult?.fetchedAt, selectedComposeProject, selectedContainerId, tailLines, visibleLogLines.length]);

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
    selectedComposeProjectRef.current = undefined;
    selectedContainerIdRef.current = container.id;
    setConfirmComposeProjectContainer(undefined);
    setSelectedComposeProject(undefined);
    setSelectedContainerId(container.id);
    await loadLogs(container.id);
  }

  async function selectComposeGroup(group: DockerContainerGroup) {
    if (!group.composeProject) {
      await selectContainer(group.containers[0]);
      return;
    }

    selectedComposeProjectRef.current = group.composeProject;
    selectedContainerIdRef.current = undefined;
    setConfirmRemoveContainer(undefined);
    setSelectedComposeProject(group.composeProject);
    setSelectedContainerId(undefined);
    await loadComposeLogs(group);
  }

  async function selectTailLines(nextTailLines: DockerLogTailLines) {
    tailLinesRef.current = nextTailLines;
    setTailLines(nextTailLines);
    if (selectedComposeGroup) {
      await loadComposeLogs(selectedComposeGroup, nextTailLines);
    } else if (selectedContainerId) {
      await loadLogs(selectedContainerId, nextTailLines);
    }
  }

  async function runContainerAction(action: DockerContainerAction, container = selectedContainer) {
    if (!container) {
      return;
    }

    setPendingAction(action);
    setActionError(undefined);
    try {
      await runClient(() =>
        tauriClient.runDockerContainerAction({
          hostId: host.id,
          containerId: container.id,
          action,
        }),
      );
      setConfirmRemoveContainer(undefined);
      await loadContainers();
    } catch (error) {
      setActionError(error as AppError);
    } finally {
      setPendingAction(undefined);
    }
  }

  async function confirmRemove() {
    if (!confirmRemoveContainer) {
      return;
    }

    await runContainerAction(isContainerRunning(confirmRemoveContainer) ? "forceRemove" : "remove", confirmRemoveContainer);
  }

  async function runComposeAction(action: DockerComposeAction, container = selectedContainer) {
    if (!container?.compose) {
      return;
    }

    setPendingComposeAction(action);
    setActionError(undefined);
    try {
      await runClient(() =>
        tauriClient.runDockerComposeAction({
          hostId: host.id,
          containerId: container.id,
          action,
        }),
      );
      setConfirmComposeProjectContainer(undefined);
      await loadContainers();
    } catch (error) {
      setActionError(error as AppError);
    } finally {
      setPendingComposeAction(undefined);
    }
  }

  const logLineCount = visibleLogLines.length;
  const actionsDisabled = Boolean(pendingAction) || Boolean(pendingComposeAction) || isLoadingContainers;

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
                {containerGroups.map((group) => {
                  const isGroupActive = group.composeProject ? selectedComposeProject === group.composeProject : false;
                  return (
                    <div key={group.id} className="docker-compose-group">
                      <div className="docker-compose-group-header" data-active={isGroupActive}>
                        <button
                          type="button"
                          className="docker-compose-group-title"
                          onClick={() => void selectComposeGroup(group)}
                        >
                          <span className="docker-compose-group-name">
                            {group.composeProject ? `${t("compose")} ${group.label}` : group.label}
                          </span>
                          <span className="docker-compose-group-meta">{group.containers.length}</span>
                        </button>
                      </div>
                      <div className="docker-compose-group-containers">
                        {group.containers.map((container) => {
                          const isRunning = container.state.toLowerCase() === "running";
                          return (
                            <button
                              key={container.id}
                              type="button"
                              onClick={() => void selectContainer(container)}
                              className="docker-container-row"
                              data-active={!selectedComposeProject && container.id === selectedContainerId}
                            >
                              <span
                                className={clsx(
                                  "docker-status-dot",
                                  isRunning ? "docker-status-dot-running" : "docker-status-dot-muted",
                                )}
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-[var(--color-text)]">{container.name}</span>
                                <span className="block truncate text-[10px] text-[var(--color-text-muted)]">
                                  {container.image}
                                </span>
                              </span>
                              <span className="truncate text-right text-[10px] uppercase text-[var(--color-text-muted)]">
                                {container.state}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="docker-log-pane">
            <div className="docker-log-toolbar">
              <div className="min-w-0">
                <div className="truncate text-xs uppercase text-[var(--color-text)]">
                  {logTitle}
                </div>
                <div className="truncate text-[10px] uppercase text-[var(--color-text-muted)]">
                  {logSubtitle}
                </div>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="docker-log-search"
                placeholder={t("searchLogs")}
                aria-label={t("searchLogs")}
              />
              {selectedContainer ? (
                <div className="docker-container-actions" aria-label={t("containers")}>
                  {selectedContainerIsRunning ? (
                    <>
                      <button
                        type="button"
                        className="control-button docker-action-button"
                        onClick={() => void runContainerAction("stop")}
                        disabled={actionsDisabled}
                      >
                        {pendingAction === "stop" ? t("requesting") : t("stopContainer")}
                      </button>
                      <button
                        type="button"
                        className="control-button docker-action-button"
                        onClick={() => void runContainerAction("restart")}
                        disabled={actionsDisabled}
                      >
                        {pendingAction === "restart" ? t("requesting") : t("restartContainer")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="control-button docker-action-button"
                      onClick={() => void runContainerAction("start")}
                      disabled={actionsDisabled}
                    >
                      {pendingAction === "start" ? t("requesting") : t("startContainer")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="control-button docker-action-button docker-action-button-danger"
                    onClick={() => setConfirmRemoveContainer(selectedContainer)}
                    disabled={actionsDisabled}
                  >
                    {pendingAction === "remove" || pendingAction === "forceRemove" ? t("requesting") : t("removeContainer")}
                  </button>
                </div>
              ) : null}
              {composeActionContainer ? (
                <div className="docker-compose-actions" aria-label={t("compose")}>
                  <button
                    type="button"
                    className="control-button docker-compose-button docker-action-button-danger"
                    onClick={() => setConfirmComposeProjectContainer(composeActionContainer)}
                    disabled={actionsDisabled}
                  >
                    {pendingComposeAction === "rebuildProject" ? t("requesting") : t("rebuildProject")}
                  </button>
                </div>
              ) : null}
              {confirmRemoveContainer ? (
                <div className="docker-action-confirm" data-danger={isContainerRunning(confirmRemoveContainer)}>
                  <span>
                    {t(isContainerRunning(confirmRemoveContainer) ? "confirmForceRemoveContainer" : "confirmRemoveContainer", {
                      name: confirmRemoveContainer.name,
                    })}
                  </span>
                  <button
                    type="button"
                    className="control-button docker-action-confirm-button"
                    onClick={() => setConfirmRemoveContainer(undefined)}
                    disabled={Boolean(pendingAction)}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="control-button docker-action-confirm-button docker-action-button-danger"
                    onClick={() => void confirmRemove()}
                    disabled={Boolean(pendingAction)}
                  >
                    {pendingAction === "remove" || pendingAction === "forceRemove" ? t("requesting") : t("delete")}
                  </button>
                </div>
              ) : null}
              {confirmComposeProjectContainer?.compose ? (
                <div className="docker-action-confirm" data-danger="true">
                  <span>
                    {t("confirmRebuildComposeProject", {
                      name: confirmComposeProjectContainer.compose.project,
                    })}
                  </span>
                  <button
                    type="button"
                    className="control-button docker-action-confirm-button"
                    onClick={() => setConfirmComposeProjectContainer(undefined)}
                    disabled={Boolean(pendingComposeAction)}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="control-button docker-action-confirm-button docker-compose-confirm-button docker-action-button-danger"
                    onClick={() => void runComposeAction("rebuildProject", confirmComposeProjectContainer)}
                    disabled={Boolean(pendingComposeAction)}
                  >
                    {pendingComposeAction === "rebuildProject" ? t("requesting") : t("rebuildProject")}
                  </button>
                </div>
              ) : null}
              {actionError ? (
                <div className="docker-action-error">
                  <strong>{actionError.code}</strong>
                  <span>{actionError.message}</span>
                </div>
              ) : null}
            </div>

            {logsError ? (
              <ErrorBlock title={logsError.code} message={logsError.message} detail={logsError.detail} />
            ) : isLoadingLogs && !logsResult ? (
              <div className="docker-empty">{t("loadingLogs")}</div>
            ) : selectedContainer || selectedComposeGroup ? (
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
              <span>{selectedComposeGroup?.id ?? selectedContainer?.id ?? "--"}</span>
              <span>{t("rows", { count: logLineCount })}</span>
            </footer>
          </section>
        </div>
      </section>
    </div>
  );
}

function isContainerRunning(container?: DockerContainer) {
  return container?.state.toLowerCase() === "running";
}

function groupDockerContainers(containers: DockerContainer[], standaloneLabel: string): DockerContainerGroup[] {
  const groups: DockerContainerGroup[] = [];
  const groupsById = new Map<string, DockerContainerGroup>();

  for (const container of containers) {
    const compose = container.compose;
    const id = compose ? `compose:${compose.project}` : "standalone";
    let group = groupsById.get(id);

    if (!group) {
      group = {
        id,
        label: compose?.project ?? standaloneLabel,
        composeProject: compose?.project,
        composeContainer: compose ? container : undefined,
        containers: [],
      };
      groupsById.set(id, group);
      groups.push(group);
    }

    group.containers.push(container);
  }

  return groups;
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
