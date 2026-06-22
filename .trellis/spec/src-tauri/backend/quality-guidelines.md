# 质量规范

> 来源：`AGENTS.md`、`docs/roles/backend-rust.md`、`docs/roles/integration-test.md`、`docs/roles/integration-checklist.md`。

## 后端更改

- 在可用时运行 Rust 测试。
- 为新的解析器行为添加解析器 fixture 测试。
- 根据契约验证命令负载/结果的序列化。
- 验证敏感值是否未写入配置文件或日志。

后端单元测试必须有 60 秒的硬超时限制。

## Parser Fixture 测试

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

## 后端验收清单

- `host_list/create/update/delete` 可用。
- SSH 测试连接可用。
- 凭据不落明文配置。
- known_hosts 流程完整。
- `metrics_subscribe` 能持续推送 snapshot。
- `metrics_unsubscribe` 能停止任务。
- parser 有 fixture 测试。
- 错误 code 与 contracts 一致。
- 长时间采集没有明显连接泄漏或任务泄漏。

## Smoke test 清单

- `pnpm --dir web build`
- `cargo test` in `/src-tauri`
- `pnpm tauri build`
- 安装并打开 macOS app。
- 新增测试 host。
- Dashboard 刷新正常。
- 退出 app 后重启，host 仍存在。
- 删除 host 后重启，host 不再出现。

## 硬性红线

不要做：

- 将 SSH 逻辑放在前端。
- 允许前端执行任意的本地或远程 shell 命令。
- 将机密信息存储在普通配置文件中。
- 跳过 known_hosts 处理。
- 在 MVP 中实现破坏性的远程操作。
- 将视觉主题硬编码到仪表板组件中。
- 用登陆页面或通用管理模板替换该应用程序。
- 在不更新文档、前端类型、后端结构体、Mocks 和测试的情况下更改接口契约。
