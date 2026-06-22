# 指标与解析器

> 来源：`AGENTS.md`、`docs/roles/backend-rust.md`、`docs/roles/contracts.md`、`docs/vpscope-plan.md`。

## 指标规则

- CPU 百分比必须根据 `/proc/stat` 样本之间的增量 (deltas) 计算。
- 网络速率必须根据 `/proc/net/dev` 样本之间的增量计算。
- 磁盘 IO 速率必须根据 `/proc/diskstats` 样本之间的增量计算。
- 首次采样可以是预热样本，但不应使 UI 崩溃。
- 解析器失败必须返回结构化错误，而不是 panic。

## sampleState

`sampleState` 表示当前采样是否已有上一帧 counter：

- `warming`: 当前 collector 还没有上一帧 counter。`cpu.totalPercent`、`cpu.cores[].percent`、`network[].rxBytesPerSec`、`network[].txBytesPerSec`、`disks[].readBytesPerSec`、`disks[].writeBytesPerSec` 不是有效 delta 值，前端不能把它们当作真实 `0` 写入历史或展示为真实 rate。
- `live`: collector 已有上一帧 counter，CPU/network/disk IO delta 指标可展示并写入历史。

`warming` 样本仍可携带 system、memory、disk capacity、network total counters 和 process 等非 delta 信息，用于避免首次采集时 UI 空白。

## 实现指标 parser

每个 parser 独立文件，输入是远程命令输出字符串，输出结构化数据。

Parser 列表：

- `cpu.rs`: 解析 `/proc/stat`，计算 total 和 per-core 使用率。
- `memory.rs`: 解析 `/proc/meminfo`。
- `system.rs`: 解析 `/proc/loadavg`、`/proc/uptime`、`uname`。
- `network.rs`: 解析 `/proc/net/dev`，计算 rx/tx rate。
- `disk.rs`: 解析 `df -P` 和 `/proc/diskstats`。
- `process.rs`: 解析 `ps` 输出。

CPU 使用率注意：

- `/proc/stat` 是累计计数，必须用两次采样差值计算。
- 第一次采样可以返回 `0` 或标记 warming up。
- per-core 也需要保存上一次计数。

Network rate 注意：

- `/proc/net/dev` 是累计 bytes。
- 需要用本次和上次差值除以时间间隔。

Disk IO 注意：

- `/proc/diskstats` 是累计 sector。
- sector size 通常按 512 bytes 计算，但需要允许后续修正。

Process parser 建议命令：

```bash
ps -eo pid,ppid,user,stat,pcpu,pmem,rss,args
```

验收：

- 每个 parser 至少有 2 组 fixture 测试。
- parser 失败返回 `PARSER_FAILED`，不能 panic。

## 实现 Metrics Collector

Collector 负责合成一次完整 `HostSnapshot`，但采集按 profile 和批量模式分层：

1. 快路径每个刷新周期读取 `/proc/loadavg`、`/proc/uptime`、`/proc/stat`、`/proc/meminfo`、`/proc/net/dev`、`/proc/diskstats`。
2. 读取 CPU 原始计数并计算差值。
3. 读取内存。
4. 读取磁盘 IO 累计值并计算速率。
5. 读取网络累计值并计算速率。
6. 慢路径按 profile 低频刷新 `uname`、`df -P`，并复用系统静态信息和磁盘容量。
7. 进程路径只在 `active` profile 按需刷新 `ps`；`overview` 和 `tray` 不采集进程列表。
8. 合成 `HostSnapshot`，并把最近一次成功 snapshot 缓存在内存中供 `metrics_last_snapshot` 读取。

采集执行要求：

- 快路径、慢路径和进程路径都通过 `SshClient::collect_metrics` 的固定批量命令执行，避免一个刷新周期内串行发出多条 SSH command。
- 首次 `active` 采集必须使用 full batch，保证 snapshot 有系统信息、磁盘容量和进程列表。
- 首次 `overview`/`tray` 采集只需要 slow batch，不运行 `ps`。
- 在高频刷新间隔下，不能每帧运行 `ps`、`df -P` 或 `uname`。
- `/proc/diskstats` 速率按累计 sector 差值计算，默认 sector size 为 512 bytes。

验收：

- 连续采集时 CPU、网络速率不是固定 0。
- 单个指标失败时可以降级，除非核心命令不可用。
- snapshot 字段符合 `contracts.md`。

## 实现订阅调度

`metrics_subscribe`：

- 创建 subscription id。
- 启动后台任务。
- 按 `CollectionProfile` 解析 interval 并调用 collector。
- 通过 `metrics://snapshot` 推送。
- 失败时通过 `metrics://error` 推送。

`metrics_unsubscribe`：

- 根据 subscription id 取消任务。
- 如果该 host 没有其他订阅，安排 idle timeout 后释放 SSH session。

`metrics_last_snapshot`：

- 返回后端内存中最近一次成功采集的 `HostSnapshot`。
- 没有缓存时返回 `null`。
- 用于前端打开窗口或切换 host 时先显示最近状态。

实现要求：

- `active` 刷新间隔限制在 500ms 到 10000ms。
- `overview` 刷新间隔限制在 5000ms 到 30000ms。
- `tray` 刷新间隔限制在 30000ms 到 300000ms。
- 后台任务必须可取消。
- app 退出时停止所有任务。
- 不要把同一个 host 的多个面板变成多个采集循环。

验收：

- 切换 host 后旧 host 不再持续推送。
- 重复订阅不会无限创建 SSH 连接。
- 后端长时间运行没有任务泄漏。

## 进程列表命令

`process_list` 用于按需获取进程列表。

要求：

- 支持 sortBy: cpu/memory/pid/name。
- 支持 sortDirection。
- 支持 filter。
- 支持 limit。
- filter 在后端做一次，前端也可以本地再过滤。

验收：

- 进程列表和 `ps/top` 基本一致。
- limit 生效。
- filter 不会注入 shell，因为命令仍然固定，过滤在 Rust 内存中做。

## disks 语义

`disks` 表示适合监控展示的文件系统挂载，不是 `df -P` 的原始全量输出。后端应过滤 `tmpfs`、`devtmpfs`、`efivarfs`、`proc`、`sysfs`、`cgroup*`、`overlay` 等虚拟或运行时文件系统，以及 `/proc`、`/sys`、`/run`、`/dev` 下的运行时挂载。
