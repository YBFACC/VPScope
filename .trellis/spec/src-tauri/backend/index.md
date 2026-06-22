# 后端开发规范 (Backend Development Guidelines)

> 来源：已归档的 `AGENTS.md`、`docs/roles/backend-rust.md`、`docs/roles/contracts.md`、`docs/vpscope-plan.md`、`src-tauri/src/`。

本目录只归档 `/src-tauri` 后端约束。项目约束使用来源文档原句，不做词替换。

## 规范索引

| 规范 | 描述 | 状态 |
|-------|-------------|--------|
| [架构与目录](./architecture.md) | `/src-tauri` 目录边界、模块拆分、Tauri/Rust 基线 | 已归档 |
| [SSH 与安全](./ssh-and-security.md) | SSH、known_hosts、凭据、远程命令白名单 | 已归档 |
| [指标与解析器](./metrics-and-parsers.md) | collector、profile、parser、delta 指标 | 已归档 |
| [质量规范](./quality-guidelines.md) | Rust 测试、fixture、serde、验证要求 | 已归档 |

## Pre-Development Checklist

- 读取 `.trellis/spec/guides/product-scope.md`。
- 读取 `architecture.md`、`ssh-and-security.md`、`quality-guidelines.md`。
- 如果改动命令、事件、数据形状或错误代码，读取 `docs/roles/contracts.md` 和 `.trellis/spec/guides/contract-and-integration.md`。
- 如果改动 SSH、known_hosts、凭据或远程命令，读取 `ssh-and-security.md`。
- 如果改动指标采集、parser、snapshot 或调度，读取 `metrics-and-parsers.md`。

## Quality Check

- 在可用时运行 Rust 测试。
- 为新的解析器行为添加解析器 fixture 测试。
- 根据契约验证命令负载/结果的序列化。
- 验证敏感值是否未写入配置文件或日志。
- 后端单元测试必须有 60 秒的硬超时限制。
