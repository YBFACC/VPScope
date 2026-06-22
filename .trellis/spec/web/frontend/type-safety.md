# 类型安全 (Type Safety)

> 来源：`AGENTS.md`、`docs/roles/frontend.md`、`docs/roles/contracts.md`、`web/src/types/contracts.ts`。

## 建立接口类型

1. 根据 [接口契约](/Users/ybf/code/VPScope/docs/roles/contracts.md) 创建 `/web/src/types/contracts.ts`。
2. 不要在组件里重复定义 `HostSnapshot`、`ProcessInfo` 等类型。
3. 所有 API client、store、mock 都从 `contracts.ts` 引入类型。

验收：

- 修改接口字段时，TypeScript 能提示所有受影响位置。

## 通信方式

- 请求/响应：Tauri `invoke(command, payload)`。
- 实时数据：Tauri event。
- 错误返回：所有命令返回统一 `AppError`。
- 时间字段：统一使用 Unix milliseconds。
- 字节字段：统一使用 bytes。
- 百分比字段：统一使用 `0` 到 `100` 的 number。

## 契约规则

前端/后端的边界由 `docs/roles/contracts.md` 定义。

当更改命令、事件、数据形状或错误代码时：

1. 更新 `docs/roles/contracts.md`。
2. 更新前端 TypeScript 类型。
3. 更新 Rust serde 结构体。
4. 更新 Mock 数据和测试。
5. 验证 UI 组件或解析器代码中是否遗留了旧的假设。

## sampleState

`sampleState` 表示当前采样是否已有上一帧 counter：

- `warming`: 当前 collector 还没有上一帧 counter。`cpu.totalPercent`、`cpu.cores[].percent`、`network[].rxBytesPerSec`、`network[].txBytesPerSec`、`disks[].readBytesPerSec`、`disks[].writeBytesPerSec` 不是有效 delta 值，前端不能把它们当作真实 `0` 写入历史或展示为真实 rate。
- `live`: collector 已有上一帧 counter，CPU/network/disk IO delta 指标可展示并写入历史。

`warming` 样本仍可携带 system、memory、disk capacity、network total counters 和 process 等非 delta 信息，用于避免首次采集时 UI 空白。

## 当前文件示例

- `web/src/types/contracts.ts`
- `web/src/lib/tauriClient.ts`
- `web/src/mocks/mockSnapshots.ts`
- `web/src/mocks/mockTauriClient.ts`
