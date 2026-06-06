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

## 验收记录

| Item | Result | Evidence / Notes |
| --- | --- | --- |
| 新增 host 后测试连接成功 | 未测 |  |
| 首次连接展示 fingerprint，并由用户确认 | 未测 |  |
| Dashboard 连续观察 5 分钟，snapshot 持续更新 | 未测 |  |
| CPU / load 与 `top`、`cat /proc/loadavg` 对比在合理范围 | 未测 |  |
| Memory 与 `free -m` 对比在合理范围 | 未测 |  |
| Disk 与 `df -h` / `df -P` 对比挂载和容量一致 | 未测 |  |
| Network 接口与 `/proc/net/dev` 对应，速率随流量变化 | 未测 |  |
| 断网或停 sshd 后 UI 进入可恢复错误状态 | 未测 |  |
| 恢复网络或 sshd 后 snapshot 继续更新 | 未测 |  |
| 删除 host 后不再收到旧 host 订阅事件 | 未测 |  |

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

- Overall result: 未通过 / 有条件通过 / 通过
- Release blocker:
- Follow-up issues:
