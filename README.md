# UI Mermaid Writer Spec

面向 **UI Node Tree & Notes Exporter v10.10+** 交接文本的 Mermaid `sequenceDiagram` 转写规范与 Codex Skill。

## 当前版本

- Skill：[`SKILL_UI_Mermaid_Writer_v1.3.md`](SKILL_UI_Mermaid_Writer_v1.3.md)
- 完整规范：[`UI控件交互图_Mermaid转写规范_v2.3.md`](UI控件交互图_Mermaid转写规范_v2.3.md)
- Codex 入口：[`SKILL.md`](SKILL.md)
- Figma 插件源码：[`plugin/`](plugin/)

## 插件源码

当前功能分支 `feature/deepseek-mmd-generator` 中，`plugin/` 是 **UI Node Tree & Notes Exporter v10.11 DeepSeek MMD Preview** 的完整可加载源码；`main` 仍保持原 v10.10，不受影响。

- `manifest.json`：Figma 插件清单
- `code.js`：Figma 主线程逻辑
- `ui.html`：侧栏界面与交接处理逻辑
- `README.md`：插件版本说明
- `tests/variant-semantics.regression.test.js`：Variant 数据语义回归测试
- `tests/deepseek-mmd-guardrails.regression.test.js`：DeepSeek 请求与防脑补回归测试
- `scripts/embed-deepseek-rulebook.js`：将完整 Skill 与规范原文嵌入 DeepSeek 请求规则包
- `deepseek_bridge.py` / `start_deepseek_bridge.bat`：Figma 无法直连时使用的本机回环 Python 桥接
- `DEEPSEEK_MMD.md`：API、隐私和生成边界说明

在 Figma Desktop 的开发插件菜单中选择 `plugin/manifest.json` 即可加载。

## v10.11 DeepSeek MMD 功能分支

- 使用 DeepSeek 官方 `https://api.deepseek.com/chat/completions` 生成 Mermaid。
- API Key 仅保存于本机 Figma `clientStorage`，不会进入项目文件或导出资料。
- API 请求使用 Figma 插件 UI 网络通道，避免主线程直连第三方 API 时触发 CORS `Failed to fetch`。
- 直连仍失败时自动回退到可选本机 Python 桥接；桥接只监听 `127.0.0.1`，不保存或打印 API Key。
- 默认使用 `deepseek-v4-pro`，可切换 Flash 或深度思考。
- 每次请求先让模型完整通读 Skill v1.3 与规范 v2.3，再读取节点事实和交接资料并生成 MMD；不使用摘要替代原文。
- 规则包带文档 SHA-256，并由回归测试逐字核对嵌入内容与源文档一致。
- 交接文档可直接修改并作为 DeepSeek 的主要业务输入；插件从未忽略节点确定性生成按组件分组的根到叶结构链，防止模型压缩中间容器或混写组件边界。
- 原始结构化节点事实不再作为扁平生成输入，只用于本地节点、participant 中文作用和结构完整性校验。
- 本地校验真实节点、完整父子链、初始化运行时混入和高风险脑补词；自动修正采用最小编辑原则，避免重写已经正确的状态组织。

## v10.10 同步重点

- 全文统一使用“交互说明”。
- 忽略与恢复均作用于当前节点及其全部后代。
- `` `真实节点名`（中文作用） `` 中，反引号内名称是权威节点名，括号内容仅作职责解释。
- Variant 对应节点按相对层级路径、节点类型、同级同名出现序号匹配。
- Variant 业务差异只认节点新增、节点缺失和 `effectiveVisible` 变化；纯视觉变化不进入业务状态。
- Variant 根组件自身的 Figma `visible` 不向内部业务节点传播。
- `matched / recovered / manual / ambiguous / new` 仅为备注迁移诊断，不进入 Mermaid。

## 使用

将本项目目录作为 Codex Skill 使用时，从 `SKILL.md` 进入；直接交给模型时，可同时提供版本化 Skill 与完整规范。

## 来源与署名

Concept & Vibe Coding by Shu.
