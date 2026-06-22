# 代码复用思考指南 (Code Reuse Thinking Guide)

> **目的**：在编写新代码之前停下来想一想 —— 这段逻辑是否已经存在？

---

## 问题所在

**重复代码是导致一致性 Bug 的第一大根源。**

当你复制粘贴或重写现有逻辑时：
- Bug 修复无法同步传播
- 随着时间的推移，行为会发生偏差
- 代码库变得越来越难理解

---

## 编写新代码之前

### 第一步：先进行搜索

```bash
# 搜索类似的函数名称
grep -r "functionName" .

# 搜索类似的逻辑
grep -r "keyword" .
```

### 第二步：问自己以下问题

| 问题 | 如果答案是“是”... |
|----------|-----------|
| 是否存在类似的函数？ | 使用或扩展它 |
| 这种模式是否在其他地方使用过？ | 遵循现有的模式 |
| 这可以作为共享的实用程序吗？ | 在合适的地方创建它 |
| 我是否正在从另一个文件复制逻辑？ | **停下** —— 将其提取到共享位置 |

---

## 常见的重复模式

### 模式 1：复制粘贴的函数

**不佳的做法**：将一个验证函数复制到另一个文件。

**良好的做法**：提取到共享的实用程序中，并在需要的地方导入。

### 模式 2：相似的组件

**不佳的做法**：创建一个与现有组件 80% 相似的新组件。

**良好的做法**：通过 props/variants 扩展现有组件。

### 模式 3：重复的常量

**不佳的做法**：在多个文件中定义同一个常量。

**良好的做法**：保持单一事实来源，并在各处导入。

### 模式 4：重复的载荷（Payload）字段提取

**不佳的做法**：多个消费者在本地强制转换同一个 JSON/事件字段：

```typescript
const description = (ev as { description?: string }).description;
const context = (ev as { context?: ContextEntry[] }).context;
```

即使代码只有两行，这也是重复的契约逻辑。每个消费者现在都有自己对“有效载荷”的定义。

**良好的做法**：将解码器、类型守卫（type guard）或投影（projection）放在数据所有者旁边：

```typescript
if (isThreadEvent(ev)) {
  renderThreadEvent(ev);
}
```

**规则**：如果在 2 个或更多地方读取了同一个未指定类型的载荷字段，请在添加第 3 个读取器之前，先创建一个共享的类型守卫 / 规范化器（normalizer） / 投影。

---

## 何时进行抽象

**在以下情况下进行抽象**：
- 相同的代码出现了 3 次以上
- 逻辑足够复杂，容易产生 Bug
- 多个开发者可能会需要它

**在以下情况下不要抽象**：
- 仅使用一次
- 简单的单行代码
- 抽象带来的复杂度高于代码重复的代价

---

## 批量修改之后

当你对多个文件进行了类似的更改时：

1. **审查**：你是否找全了所有实例？
2. **搜索**：运行 grep 查找是否有遗漏
3. **思考**：这是否应该进行抽象？

### Reducer 应使用穷尽式结构

当状态是从类似 Action 的值（`action`、`kind`、`status`、`phase`）派生时，优先使用带有一个 `switch` 的 reducer，而不是零散的 `if/else` 更新。

```typescript
// 不佳的做法 - 难以审计特定 action 的状态过渡
if (action === "opened") { ... }
else if (action === "comment") { ... }
else if (action === "status") { ... }

// 良好的做法 - 由一个 reducer 拥有过渡表
switch (event.action) {
  case "opened":
    ...
    return;
  case "comment":
    ...
    return;
}
```

当事件日志是事实来源时，这尤为重要。Reducer 是记录在案的重放模型（replay model）；展示代码和命令不应复制该重放模型的部分内容。

---

## 提交前清单

- [ ] 搜索了现有的类似代码
- [ ] 没有复制粘贴本应共享的逻辑
- [ ] 在共享解码器之外，没有重复的未指定类型载荷字段提取
- [ ] 常量定义在同一个地方
- [ ] 相似的模式遵循相同的结构
- [ ] Reducer/Action 过渡存在于单个 reducer 或命令分发器（command dispatcher）中

---

## 易错点：Python 中 if/elif/else 的穷尽性检查

**问题**：Python 的 if/elif/else 链没有编译期的穷尽性检查。当你在 `Literal` 类型（例如 `Platform`）中添加新值时，现有的 if/elif/else 链会静默地回退到 `else`，从而导致错误的默认行为。

**现象**：新平台部分工作 —— 某些方法返回了 Claude 的默认值，而不是特定于该平台的属性。并且不报错。

**示例** (`cli_adapter.py`)：
```python
# 不佳的做法： "gemini" 跌落到 else，返回 "claude"
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    else:
        return "claude"  # gemini 静默得到了 "claude"！

# 良好的做法：为每个平台编写显式分支
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    elif self.platform == "gemini":
        return "gemini"
    else:
        return "claude"
```

**防范措施**：当向 Python 的 `Literal` 类型添加新值时，搜索所有根据该类型进行条件判断的 if/elif/else 链，并添加显式分支。不要依赖 `else` 对新值能返回正确的结果。

---

## 易错点：产生相同输出的非对称机制

**问题**：当两种不同的机制必须生成相同的文件集时（例如，初始化时使用递归目录复制 vs. 更新时使用手动的 `files.set()`），结构变化（重命名、移动、添加子目录）只会通过自动机制传播。手动的那个会静默地发生偏差。

**现象**：初始化工作完美，但更新会在错误的路径下创建文件，或者完全遗漏文件。

**防范措施**：
- **最佳方案**：消除非对称性 —— 让手动路径调用自动路径（call the automatic one）（例如，让 `collectTemplateFiles()` 调用 `getAllScripts()`，而不是维护自己的列表）
- **如果非对称性不可避免**：添加一个对比两种机制输出的回归测试
- 在迁移目录结构时，搜索所有引用旧结构的编码路径

**真实案例**：`trellis update` 曾经为 11 个脚本维护了一个手动的 `files.set()` 列表，而 `getAllScripts()` 已经对其进行了追踪。修复方法：删除了重复的手动列表，改用 `for..of getAllScripts()` 循环。参见 v0.4.0-beta.3 中的 `update.ts` 重构。

---

## 模板文件注册（Trellis 专属）

当向 `src/templates/trellis/scripts/` 添加新文件时：

**单一注册点**：`src/templates/trellis/index.ts`

1. 添加 `export const xxxScript = readTemplate("scripts/path/file.py");`
2. 添加到 `getAllScripts()` Map 中

就是这样。`commands/update.ts` 会直接使用 `getAllScripts()` —— 无需手动同步。

**为什么这很重要**：如果不向 `getAllScripts()` 注册，`trellis update` 就不会将该文件同步到用户的项目中。Bug 修复和新特性将无法传播。

**历史背景**：在 v0.4.0-beta.3 之前，`update.ts` 拥有自己手动维护的文件列表，经常与 `getAllScripts()` 不同步。这导致在执行 `trellis update` 时静默跳过了 11 个 Python 文件。修复方法是消除重复的列表，将 `getAllScripts()` 作为唯一的事实来源。

### 新脚本快速检查清单

```bash
# 添加新的 .py 文件后，验证它是否已在 getAllScripts() 中：
grep -l "newFileName" src/templates/trellis/index.ts  # 应当匹配
```

### 模板同步规范

`.trellis/scripts/`（自用）和 `packages/cli/src/templates/trellis/scripts/`（模板）必须保持完全一致。在编辑 `.trellis/scripts/` 后，务必进行同步：

```bash
rsync -av --delete --exclude='__pycache__' .trellis/scripts/ packages/cli/src/templates/trellis/scripts/
```

**易错点**：使用错误的源/目的路径运行 rsync 可能会创建嵌套的垃圾目录（例如 `.trellis/scripts/packages/cli/...`）。运行前务必双击确认路径。
