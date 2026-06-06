import type { AlertRule, HostConfig, HostSnapshot } from "@/types/contracts";

export const DEFAULT_ALERT_THRESHOLD_PERCENT = 90;
export const DEFAULT_ALERT_COOLDOWN_MS = 10 * 60 * 1000;

export type AlertRuntimeState = {
  aboveThreshold: boolean;
  lastTriggeredAt?: number;
};

export type AlertTrigger = {
  rule: AlertRule;
  host: HostConfig;
  value: number;
};

export function evaluateCpuAlert(
  rule: AlertRule,
  host: HostConfig | undefined,
  snapshot: HostSnapshot,
  previous: AlertRuntimeState | undefined,
): { next: AlertRuntimeState; trigger?: AlertTrigger } {
  if (snapshot.sampleState !== "live") {
    return {
      next: previous ?? { aboveThreshold: false },
    };
  }

  const value = snapshot.cpu.totalPercent;
  const aboveThreshold = rule.enabled && value >= rule.thresholdPercent;
  const lastTriggeredAt = previous?.lastTriggeredAt;
  const crossedThreshold = aboveThreshold && previous?.aboveThreshold !== true;
  const cooldownExpired = lastTriggeredAt === undefined || snapshot.ts - lastTriggeredAt >= rule.cooldownMs;
  const shouldTrigger = Boolean(host && crossedThreshold && cooldownExpired);

  return {
    next: {
      aboveThreshold,
      lastTriggeredAt: shouldTrigger ? snapshot.ts : lastTriggeredAt,
    },
    trigger: shouldTrigger && host ? { rule, host, value } : undefined,
  };
}

export function alertHostIds(rules: AlertRule[]) {
  return Array.from(new Set(rules.filter((rule) => rule.enabled).map((rule) => rule.hostId)));
}

export function createCpuAlertRule(hostId: string, now = Date.now()): AlertRule {
  return {
    id: `cpu-${hostId}`,
    hostId,
    metric: "cpu",
    enabled: true,
    thresholdPercent: DEFAULT_ALERT_THRESHOLD_PERCENT,
    cooldownMs: DEFAULT_ALERT_COOLDOWN_MS,
    createdAt: now,
    updatedAt: now,
  };
}
