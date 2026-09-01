# DeepSeek MMD 生成说明

本功能只存在于 `feature/deepseek-mmd-generator` 分支，不改变 `main` 上的 v10.10 插件。

## API

- Endpoint：`https://api.deepseek.com/chat/completions`
- 默认模型：`deepseek-v4-pro`
- 可选模型：`deepseek-v4-flash`
- 输出：DeepSeek JSON Output，固定解析 `mmd`、`warnings`、`evidence_gaps`
- 网络白名单：仅 `https://api.deepseek.com`

模型和接口以 DeepSeek 官方文档为准：

- <https://api-docs.deepseek.com/>
- <https://api-docs.deepseek.com/api/create-chat-completion/>

## API Key 与隐私

API Key 通过 Figma 插件主线程写入本机 `figma.clientStorage`。插件不会：

- 把 Key 写入 `code.js`、`ui.html` 或 Git；
- 把 Key 放进备注 JSON、组件资料、交接文档或 MMD；
- 把 Key 回传到 UI 输入框；
- 向 DeepSeek 以外的域名发送网络请求。

实际 API 请求由插件自身的 UI iframe 发出，以兼容 Figma 插件网络与 CORS 机制。已保存的 Key 只在用户点击生成时从主线程传入同一插件 UI 的内存，用于构造 `Authorization` 请求头；不会回填输入框、写入页面、请求正文或日志。

点击“清除 Key”会删除本机保存的 Key。关闭“记住 API Key”后，本次输入仅用于当前生成与可能发生的一次自动修正。

生成时会把 `SKILL_UI_Mermaid_Writer_v1.3.md` 完整原文、`UI控件交互图_Mermaid转写规范_v2.3.md` 完整原文、当前完整交接资料与未忽略业务节点清单发送给 DeepSeek。Figma 设计文件本身不会被上传，只有这两份规则文档与插件已经整理出的文本事实会进入请求。

## 完整规则包

每次生成和自动修正都会按以下顺序组织请求：

```text
1. 完整通读 Skill v1.3
2. 完整通读规范 v2.3
3. 读取未忽略业务节点清单
4. 读取完整交接资料
5. 开始生成或修正 MMD
```

插件不会使用摘要替代两份原文。`plugin/code.js` 中的规则包由 `plugin/scripts/embed-deepseek-rulebook.js` 从仓库根目录文档生成，并记录两份原文的 SHA-256。回归测试会把嵌入内容和源文档逐字比对；文档更新后必须重新执行该脚本，否则测试失败。

“交接文档”页允许直接修改当前完整文本。手动修改后，DeepSeek 使用当前文本作为业务语义、交互说明、状态、动态值和测试修正的主要来源；插件仍会单独发送结构化节点事实，约束真实节点名、路径、类型和组件边界。点击“恢复自动生成”可放弃手动版本并恢复最新聚合结果。

## 防脑补策略

完整 Skill 与规范共同约束生成，其核心是：

```text
可以理解
可以整理
可以归纳
但不能创造
```

重点禁止：

- 资料未提供的创建、销毁、新增、删除、刷新、复用、重排或更新列表；
- 跳过真实中间容器，只保留叶子节点；
- 把关联组件写成主组件的真实子树；
- 把运行时行为塞进初始摆放阶段；
- 把平行内容形态写成有先后顺序的状态机；
- 用中文语义替换真实节点名；
- 发明 API、事件、变量、回调、状态机或程序算法；
- 把当前 Figma 隐藏当作业务默认隐藏；
- 把列表为空解释成列表隐藏；
- 把纯视觉 Variant 自动写成业务状态。

## 本地校验与自动修正

DeepSeek 返回结果后，插件会检查：

- 是否包含 `sequenceDiagram`；
- 是否包含 `rect rgb(240,240,240)` 初始摆放阶段；
- 所有未忽略业务节点的真实名称是否都保留；
- 是否出现资料外的反引号节点；
- 是否出现资料未提供的高风险程序行为；
- 初始摆放阶段是否混入运行时逻辑。

默认开启“一次自动修正”。修正后仍有问题时，插件不会假装通过，而会保留 MMD 并列出需要人工确认的条目。

本地校验不能证明业务语义绝对正确。组件边界、复杂状态和资料本身的歧义仍应由使用者最终确认。
