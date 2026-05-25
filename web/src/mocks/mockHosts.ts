import type { HostConfig, HostConnectionState } from "@/types/contracts";

const now = Date.now();

export const mockHosts: HostConfig[] = [
  {
    id: "mock-vps-1",
    name: "pmuv3",
    address: "45.79.23.18",
    port: 22,
    auth: {
      type: "ssh_agent",
      username: "ubuntu",
    },
    refreshIntervalMs: 2_000,
    tags: ["prod", "edge"],
    createdAt: now - 21 * 86_400_000,
    updatedAt: now - 3_600_000,
  },
  {
    id: "mock-vps-2",
    name: "db-small-01",
    address: "10.8.0.42",
    port: 22,
    auth: {
      type: "private_key",
      username: "ops",
      keyPath: "~/.ssh/id_ed25519",
    },
    refreshIntervalMs: 3_000,
    tags: ["staging", "postgres"],
    createdAt: now - 12 * 86_400_000,
    updatedAt: now - 2 * 86_400_000,
  },
];

export const mockConnectionStates: HostConnectionState[] = mockHosts.map((host, index) => ({
  hostId: host.id,
  status: index === 0 ? "connected" : "disconnected",
  message: index === 0 ? "streaming metrics" : "idle",
  latencyMs: index === 0 ? 38 : undefined,
  lastConnectedAt: index === 0 ? Date.now() - 22_000 : undefined,
}));
