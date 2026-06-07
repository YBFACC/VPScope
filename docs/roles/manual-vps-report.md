# 真实 VPS 手工联调报告

本报告用于闭环 `integration-checklist.md` 中的真实 VPS 手工联调项。不要填写密码、私钥、passphrase、token 或完整敏感凭据。

## 测试信息

- Date:
- Tester:
- VPS label:
- SSH target alias or host:
- Port:
- Username:
- Auth type: `ssh_agent` / `private_key`
- OS:
- CPU cores:
- Memory:
- Disk mounts:
- Network interfaces:
- VPScope version / commit:

## 采样证据

本地采样命令：

```sh
scripts/collect-vps-baseline.sh --target <ssh-alias-or-user@host> --interval 10 --duration 300
```

采样脚本使用本机 OpenSSH，并要求目标机 host key 已在本机信任链内；它不会自动接受未知 fingerprint。首次 fingerprint 的产品验收仍以 VPScope UI 为准。

- Baseline log path:
- Dashboard screenshots:
- App logs path, if any:

## known_hosts / fingerprint 证据

Rust 真实环境验收命令：

```sh
VPSCOPE_TEST_SSH_HOST=<host-or-ip> \
VPSCOPE_TEST_SSH_USER=<username> \
VPSCOPE_TEST_SSH_PORT=<port> \
scripts/verify-known-hosts-flow.sh
```

可选：如果不使用 ssh-agent，可增加 `VPSCOPE_TEST_SSH_KEY_PATH=<absolute-key-path>`。该测试会让 OpenSSH 使用临时 known_hosts 文件，仍保留真实 `~/.ssh/config` / ssh-agent 行为，不会修改用户真实 known_hosts。

通过标准：

- 空 known_hosts 首次连接返回 `SSH_HOST_KEY_UNKNOWN`，并带 `SHA256:` fingerprint。
- `host_accept_key` 等价路径会重新扫描 fingerprint，匹配后写入临时系统 OpenSSH known_hosts。
- 已写入匹配 key 后，严格 known_hosts 连接成功。
- 写入同 host/port 的错误 key 后，连接返回 `SSH_HOST_KEY_CHANGED`，且不自动覆盖。

- known_hosts flow command:
- known_hosts flow result:
- Redacted known_hosts flow latest result:
  `VPSCOPE_TEST_SSH_HOST=<redacted-ssh-config-alias> VPSCOPE_TEST_SSH_USER=ubuntu VPSCOPE_TEST_SSH_PORT=22 scripts/verify-known-hosts-flow.sh` passed on 2026-06-08. The gated Rust test covered unknown key, accept/write, normal known host, and changed key blocking with a temporary known_hosts file.
- Fingerprint shown in UI:
- Fingerprint accepted in UI:
- Changed-key UI warning screenshot/log:

## 验收记录

| Item | Result | Evidence / Notes |
| --- | --- | --- |
| 新增 host 后测试连接成功 | 通过 | 已通过真实 SSH config alias 流程验证 |
| Rust 真实 known_hosts 三状态验收通过 | 通过 | `scripts/verify-known-hosts-flow.sh` passed on 2026-06-08；覆盖 unknown / accept-write / normal / changed blocking |
| 首次连接展示 fingerprint，并由用户确认 | 通过 | UI 展示 fingerprint，确认后可重试连接 |
| host key changed 时 UI 强警告且不自动连接 | 未测 |  |
| Dashboard 连续观察 5 分钟，snapshot 持续更新 | 通过 | 真实 VPS 已连续观察 |
| CPU / load 与 `top`、`cat /proc/loadavg` 对比在合理范围 | 通过 | 详见 redacted 指标准确性报告 |
| Memory 与 `free -m` 对比在合理范围 | 通过 | 详见 redacted 指标准确性报告 |
| Disk 与 `df -h` / `df -P` 对比挂载和容量一致 | 通过 | 详见 redacted 指标准确性报告 |
| Network 接口与 `/proc/net/dev` 对应，速率随流量变化 | 通过 | 详见 redacted 指标准确性报告 |
| 断网或停 sshd 后 UI 进入可恢复错误状态 | 通过 | 断网可恢复；Dashboard 保留最后一帧并通过非阻塞错误状态提示重试 |
| 恢复网络或 sshd 后 snapshot 继续更新 | 通过 | 恢复后 snapshot 继续更新 |
| 删除 host 后不再收到旧 host 订阅事件 | 通过 | 删除 VPScope app 内 host/profile 后，`host_delete` 后端清理订阅、snapshot、SSH session；前端同步清 store；不涉及系统 `known_hosts` |

## 对比口径

- Load average 应直接对应 `/proc/loadavg` 的 1、5、15 分钟值。
- Memory 允许因 cache/buffer 口径存在小幅差异，但 total、available、swap 总量应能解释。
- Disk 展示的是可监控文件系统挂载，允许过滤 tmpfs、proc、sysfs、overlay 等运行时或虚拟文件系统。
- CPU percent、network rate、disk IO rate 是采样差值，和瞬时命令输出不需要逐数字完全相同，但趋势应一致。

## 缺陷记录

```text
Title:
Severity: P0/P1/P2/P3
Area: frontend/backend/contracts/security/performance
Steps:
Expected:
Actual:
Evidence:
Suggested owner:
```

## 结论

- Overall result: 有条件通过
- Release blocker: 无已知 blocker
- Follow-up issues: changed-key UI 真实场景仍需补齐
