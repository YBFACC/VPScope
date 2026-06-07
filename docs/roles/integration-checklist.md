# VPScope 联调验收清单

## 契约基线

- [x] `docs/roles/contracts.md`、`web/src/types/contracts.ts`、Rust serde 结构字段一致。
- [x] 所有时间字段为 Unix milliseconds。
- [x] 所有 byte 字段为 bytes。
- [x] 所有 percent 字段为 `0` 到 `100` 的 number。
- [x] `AppError.code` 覆盖 `CONFIG_INVALID`、`HOST_NOT_FOUND`、`SSH_AUTH_FAILED`、`SSH_CONNECT_FAILED`、`SSH_HOST_KEY_CHANGED`、`SSH_HOST_KEY_UNKNOWN`、`REMOTE_COMMAND_FAILED`、`REMOTE_UNSUPPORTED`、`PARSER_FAILED`、`INTERNAL`。

## Mock 数据

- [x] `idleHost` 覆盖低负载、多核心 CPU、swap 为 0、多磁盘、多网卡。
- [x] `busyHost` 覆盖高负载、swap 非 0、多磁盘、多网卡、超过 200 个进程、长 command。
- [x] `errorHost` 覆盖空进程、空设备、降级 snapshot。
- [x] mock connection/error event payload 与契约类型一致。

## Parser Fixture

- [x] `/proc/stat` fixture 覆盖总 CPU 与多核心 counter。
- [x] `/proc/meminfo` fixture 覆盖 memory、cache、swap。
- [x] `/proc/net/dev` fixture 覆盖 `lo`、多物理/虚拟网卡。
- [x] `df -P` fixture 覆盖多 mount 和长 mount path。
- [x] `ps` fixture 覆盖 command 中包含空格和长参数。

## 待后端接入

- [x] 将 parser 输出映射到最终 `HostSnapshot` Rust serde structs。
- [x] 将 parser 错误转换为契约中的 `AppError { code: "PARSER_FAILED" }`。
- [x] 在 metrics collector 中用相邻采样计算 CPU、network、disk IO rate。

## 手工联调

真实 VPS 联调采用半自动证据采集加手工 UI 验收：

- 用 `scripts/collect-vps-baseline.sh --target <ssh-alias-or-user@host> --interval 10 --duration 300` 采集远端只读基线。
- 用 `docs/roles/manual-vps-report.md` 记录 dashboard、fingerprint、断网恢复、删除 host 后订阅停止等 UI 验收结果。
- 采样脚本不会自动接受未知 SSH fingerprint；首次 fingerprint 验收仍以 VPScope UI 为准。
- 用 `scripts/verify-known-hosts-flow.sh` 验证真实 unknown / accept / normal / changed known_hosts 流程；脚本内置 60 秒硬超时，测试必须使用临时 known_hosts 文件，不能改写用户真实 known_hosts。
- 清单勾选前，应在报告中附 baseline log 路径、截图或日志证据。

- [x] 新增主机弹窗第一屏展示 `~/.ssh/config` 可导入 Host 列表。
- [x] 选择 SSH config alias 后，测试连接使用 `ssh_agent`，保存后 `name = alias`、`address = alias`。
- [x] 保存 SSH config profile 后，选择该主机进入监控，确认复用系统 SSH alias 行为。
- [x] 无可导入 SSH config 条目时，弹窗提示先配置系统 `~/.ssh/config`，不提供高级手动入口。
- [x] SSH config 条目缺少 `User` 时，提示回到 `~/.ssh/config` 补齐，不在 VPScope 内手动补。
- [x] 新增主机弹窗只支持 SSH config alias 导入，不展示手动地址、private key、password 或 passphrase 输入项。
- [x] 提交旧 app-managed credential 字段时，后端返回 `CONFIG_INVALID`。
- [x] 重复 host 保存被基础校验拦截。
- [x] 测试连接。
- [x] Rust 真实 known_hosts 三状态验收通过：unknown key、确认写入、normal known host、changed key 阻断。
- [x] UI 首次连接展示 fingerprint，用户确认后可重新连接。
- [ ] UI host key changed 显示强警告，且不会自动覆盖 known_hosts。
- [x] Dashboard 连续观察 5 分钟。
- [x] 与 `top`、`free -m`、`df -h`、`cat /proc/loadavg` 对比。
- [x] 断网或停 sshd 后 UI 进入可恢复错误状态。
- [x] 恢复网络后 snapshot 继续更新。
- [x] 删除 host 后不再收到旧订阅事件。

## 当前剩余手工验收

- 真实 changed-key 场景下 UI 强警告，且不会自动覆盖 known_hosts。

## 说明

- “删除 host 后不再收到旧订阅事件”指删除 VPScope app 内保存的 host/profile 后，停止该 host 的 metrics subscription、清理 snapshot/history/process/error/connection state，并释放后端 SSH session；该项不涉及监听或删除系统 `~/.ssh/known_hosts`。
- MVP 不修改、不清理用户的 `~/.ssh/known_hosts`；host key 信任记录仍由系统 OpenSSH 维护。
- MVP 新增主机只导入已有 `~/.ssh/config` Host alias；不再提供高级手动配置或 app 内 private key profile 创建入口。
