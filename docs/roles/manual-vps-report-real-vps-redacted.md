# 真实 VPS 指标准确性报告 Redacted

本报告用于闭环最小 MVP 中“真实指标准确性还没打证据”的验收项。内容已脱敏，可提交到公开代码仓库。

## 脱敏范围

- 隐去真实 SSH alias、主机名、用户名、精确采样时间、内核构建字符串和本机路径。
- 不提交原始 baseline 日志；原始日志包含主机标识、进程列表和精确时间，仅保留统计摘要。
- 进程名按类别描述，不记录真实服务名。
- 保留 CPU、memory、disk、network 的统计结果，用于验证采集口径和修复结论。

## 测试信息

- Date: redacted
- Tester: Codex with user-triggered network load
- VPS label: redacted real VPS
- SSH target: redacted OpenSSH target
- Port: 22
- Username: redacted
- Auth type: `ssh_agent` / system OpenSSH config
- OS: Linux x86_64
- CPU cores: 2
- Memory: 954 MiB total, 2525 MiB swap total
- Disk mounts considered monitorable: root filesystem and EFI boot filesystem
- Primary external network interface: `ens3`

## Evidence

Baseline command shape:

```sh
scripts/collect-vps-baseline.sh --target <redacted-ssh-target> --interval 5 --duration 300
```

Accuracy rerun command shape:

```sh
scripts/collect-vps-baseline.sh --target <redacted-ssh-target> --interval 5 --duration 120 --out <redacted-private-log-path>
```

Backend real-SSH checks:

```sh
VPSCOPE_TEST_SSH_HOST=<redacted-ssh-target> VPSCOPE_TEST_SSH_USER=<redacted-user> cargo test openssh_client_can_connect_to_configured_host_when_enabled -- --nocapture
VPSCOPE_TEST_SSH_HOST=<redacted-ssh-target> VPSCOPE_TEST_SSH_USER=<redacted-user> cargo test collects_snapshot_from_configured_ssh_host_when_enabled -- --nocapture
```

Both tests passed. This verifies the OpenSSH client can connect to the configured real VPS and `MetricsCollector` can produce a non-empty real `HostSnapshot` from the same target.

## Baseline Summary

- Samples: 60
- Window length: about 5 minutes
- Load 1m min/avg/max: 0.01 / 0.29 / 0.90
- CPU total percent by `/proc/stat` delta min/avg/max: 3.02% / 28.5% / 49.69%
- Memory used min/avg/max: 392 MiB / 398.3 MiB / 407 MiB
- Root filesystem from `df -P`: total 51188748 KiB, used 5497428 KiB, available 43058672 KiB, capacity 12%
- `ens3` traffic delta: RX 1546.4 MiB, TX 1685.2 MiB
- `ens3` average rate: RX 3.43 MiB/s, TX 3.74 MiB/s
- `ens3` peak rate: RX 5.94 MiB/s, TX 6.47 MiB/s

## CPU 空缺调查

结论：真实 VPS baseline 中真实 CPU 没有出现 `0%`。

- Samples: 60
- 相邻 `/proc/stat` delta 区间: 59
- CPU delta min/avg/max: 3.02% / 28.5% / 49.69%
- `zero_count=0`
- `below_1pct=0`
- `top` 瞬时 `100.0 id` 样本: 39, 42, 45, 56

解释：`top` 的瞬时 `100.0 id` 样本只代表该刷新口径下当下接近空闲；按 VPScope 使用的相邻 `/proc/stat` delta 口径，这些区间仍然不是 `0%`。因此截图里的 CPU 图表空缺应按“warming 样本或无上一帧 counter 的 delta 样本被写入历史/展示成真实 0”处理，而不是远端真实 CPU 为 0。

修复记录：`HostSnapshot.sampleState` 明确区分 `warming` 与 `live`。前端在 `warming` 时不写入 CPU history 和 network rate history，CPU/network/disk IO 当前 rate 显示为 `--`，memory history 继续写入。

## Accuracy Rerun

本轮为用户要求的再次提权真实 SSH 验证，用于给“真实指标准确性”补最新证据。

- Samples: 24
- Window length: about 2 minutes
- 相邻 `/proc/stat` delta 区间: 23
- CPU delta min/avg/max: 3.02% / 6.53% / 18.22%
- `zero_count=0`
- `below_1pct=0`
- `top` 瞬时 `100.0 id` 样本: 3, 6, 8, 18, 23, 24
- `ens3` rate min/avg/max: RX 0.12 / 0.68 / 2.21 MiB/s, TX 0.12 / 0.72 / 2.34 MiB/s
- Memory used range: 395-405 MiB
- Memory available range: 549-558 MiB
- Root filesystem from `df -P`: 12%
- Backend real SSH collector test rerun: `collects_snapshot_from_configured_ssh_host_when_enabled` passed against the redacted real VPS

解释：这次日志中再次出现 `top` 瞬时 `100.0 id`，但相邻 `/proc/stat` delta 复算仍没有任何真实 `0%` 或 `<1%` CPU 区间。因此可以继续锁定：CPU 图表空缺不是远端真实 CPU 为 0，而是 warming/无上一帧 counter 的样本进入历史或显示层造成的假空缺。

## Interpretation

- CPU/load: the pressure window is visible in both `/proc/stat` deltas and `top`; network-facing user services and kernel network handling were active during the network load. VPScope should show CPU rising into roughly the 30-50% range during the peak window, then falling back afterward.
- Memory: baseline stays stable around 392-407 MiB used. VPScope memory should show roughly 41-43% used of 954 MiB, with swap used around 4 MiB of 2525 MiB.
- Disk: VPScope uses `df -P` total and used bytes. `/` should show about 5.1 GiB used out of 48.8 GiB total. `df` reports 12% capacity because its printed capacity accounts for available/reserved-block semantics; VPScope's used/total display may read closer to 10.7%, which is explainable.
- Network: `ens3` should show clear bidirectional traffic, with peak rates around 6 MiB/s and later return toward low/idle rates. This validates the rate calculation from `/proc/net/dev` deltas.

## Result

Overall result: 有条件通过

Release blocker: No blocker found in backend metric collection against the redacted real VPS.

Remaining manual evidence: capture a VPScope dashboard screenshot during a similar `ens3` load window and compare displayed values against this report. The backend collector path has been verified, but this report does not include a desktop UI screenshot.
