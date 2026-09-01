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

点击“清除 Key”会删除本机保存的 Key。关闭“记住 API Key”后，本次输入仅用于当前生成与可能发生的一次自动修正。

生成时会把当前完整交接资料与未忽略业务节点清单发送给 DeepSeek。Figma 设计文件本身不会被上传，只有插件已经整理出的文本事实会进入请求。

## 防脑补策略

固定系统约束的核心是：

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
