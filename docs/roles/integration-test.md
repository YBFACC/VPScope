# 联调测试角色：接口契约、Mock、验收

## 角色目标

联调测试角色负责保证 `/web` 和 `/src-tauri` 能按照同一份接口契约协作，并验证 VPScope 在真实 SSH 服务器和 Mock 环境下都能稳定运行。

最终交付：

- 前后端接口契约检查。
- Mock 数据与真实数据字段一致。
- 联调测试清单。
- 关键 parser fixture。
- Dashboard 手工验收报告。
- 打包前 smoke test。

## 目录边界

主要修改：

```text
docs/
web/src/mocks/
web/src/types/
src-tauri/src/parsers/
src-tauri/tests/
```

不要重写前端 UI 组件，也不要重写后端 SSH 实现。发现问题时给出最小修正建议。

## 详细实现步骤

### Step 1: 建立契约基线

1. 读取 [接口契约](/Users/ybf/code/VPScope/docs/roles/contracts.md)。
2. 检查 `/web/src/types/contracts.ts` 是否完整覆盖契约。
3. 检查 Rust struct 是否使用相同字段名。
4. 检查错误 code 是否一一对应。

验收：

- TypeScript 类型、Rust serde 输出、文档字段一致。

### Step 2: 建立 Mock 数据集

在 `/web/src/mocks` 中至少维护 3 套 snapshot：

- `idleHost`: 低负载 VPS。
- `busyHost`: CPU、内存、网络较高。
- `errorHost`: 模拟连接失败和采集失败。

Mock 数据要覆盖：

- 多核心 CPU。
- swap 为 0 和非 0。
- 多磁盘 mount。
- 多网卡。
- 进程列表超过 200 条。
- 长 command 字符串。
- 空进程或 parser 降级场景。

验收：

- 前端只使用 mock 时能完整展示所有状态。
- Mock 字段和 `HostSnapshot` 类型一致。

### Step 3: Parser Fixture 测试

后端 parser 每类至少准备 fixture：

```text
src-tauri/tests/fixtures/
  proc_stat_ubuntu_22.txt
  proc_meminfo_ubuntu_22.txt
  proc_net_dev_multi_iface.txt
  df_p.txt
  ps_output.txt
```

测试重点：

- CPU raw counters 可解析。
- meminfo 缺字段时能降级或报明确错误。
- net dev 能忽略 lo 或标记 lo。
- df 能处理 mount path 包含长路径。
- ps 能处理 command 中包含空格。

验收：

- `cargo test` 能覆盖 parser。
- parser 测试不需要真实 SSH。

### Step 4: 建立真实 VPS 联调清单

准备一台测试 VPS，建议 Ubuntu 22.04 或 24.04。

测试前记录：

- host
- port
- username
- auth type
- CPU core 数
- memory 总量
- disk mount
- network interface

联调流程：

1. 新增 host。
2. 测试连接。
3. 首次连接确认 fingerprint。
4. 进入 Dashboard。
5. 观察 5 分钟。
6. 与远程 `top`、`free -m`、`df -h`、`cat /proc/loadavg` 对比。
7. 修改 refresh interval。
8. 断开网络或停 sshd，观察错误状态。
9. 恢复连接，观察是否恢复。
10. 删除 host，确认凭据清理。

验收：

- 核心指标误差在合理范围。
- 连接异常不会导致 UI 崩溃。
- 删除 host 后不能继续订阅旧 host。

### Step 5: 前端视觉验收

检查尺寸：

- 1280x800
- 1440x900
- 1728x1117
- 2560x1440

检查主题：

- btop classic
- mac graphite
- light lab

检查状态：

- 没有 host。
- 正在连接。
- 连接成功。
- 认证失败。
- host key unknown。
- host key changed。
- 采集中断。
- 部分指标不可用。

验收：

- 面板不重叠。
- 文字不溢出关键按钮。
- 进程表长 command 不撑破布局。
- 主题切换无残留硬编码颜色。

### Step 6: 性能验收

运行场景：

- 单 host，2 秒刷新，运行 30 分钟。
- 单 host，500ms 刷新，运行 10 分钟。
- 进程列表 500 条以上。

观察：

- 前端内存是否持续上涨。
- 后端 SSH session 数是否异常增加。
- CPU 占用是否可接受。
- UI 是否卡顿。

验收建议：

- 默认 2 秒刷新时 app 自身 CPU 不应长期高占用。
- 切换 host 不应遗留旧订阅。
- 长时间运行没有明显内存泄漏。

### Step 7: 打包前 Smoke Test

Smoke test 清单：

- `pnpm --dir web build`
- `cargo test` in `/src-tauri`
- `pnpm tauri build`
- 安装并打开 macOS app。
- 新增测试 host。
- Dashboard 刷新正常。
- 退出 app 后重启，host 仍存在。
- 删除 host 后重启，host 不再出现。

## 缺陷记录格式

发现问题时使用：

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

## 联调验收清单

- 前后端字段完全一致。
- Mock 数据覆盖主要 UI 状态。
- 真实 VPS 可以连接并采集。
- 错误状态可恢复。
- Parser 有测试。
- 打包产物能运行。

