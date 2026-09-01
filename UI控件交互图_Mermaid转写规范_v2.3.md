# 游戏 UI 拼接 → Mermaid 控件交互图转写规范
版本：v2.3（适配 UI Node Tree & Notes Exporter v10.10+）

> 目的：以后只需要提供 **本规范 + 插件导出的完整交接 TXT + 必要的额外修正说明**，即可稳定转写为项目可用的 Mermaid `sequenceDiagram`（`.mmd`）。
>
> 本规范把“Figma 节点事实、中文职责、关联组件、状态快照、交互说明”与 Mermaid 写法统一起来，避免遗漏真实层级、误判组件关系、重复描述显隐或自行脑补业务规则。

---

## 1. 最终输入与输出

### 1.1 输入

标准输入由以下内容组成：

1. **本规范文档**
2. **UI Node Tree & Notes Exporter v10.10+ 导出的完整交接 TXT**
3. **可选的额外修正说明**
   - UE / 最终工程中的真实控件名
   - Figma 名称与最终运行时名称的映射
   - 临时新增的动画控件
   - 最新策划 / 程序确认的状态规则
   - 对插件导出内容的明确覆盖说明

### 1.2 输出

默认输出：

```text
xxx.mmd
```

Mermaid 类型固定优先使用：

```mermaid
sequenceDiagram
```

目标不是画标准 UML，而是生成 **程序可直接阅读、可继续作为实现输入的控件交互图**。

---

# 2. 信息优先级

当不同输入之间存在冲突时，按以下优先级处理：

### P0：用户在当前消息中明确给出的最新修正
优先级最高。

例如：

```text
Figma 中叫 img_progress_left，
但导出到 UE 后实际控件名是 frame_progress_left_progressBar。
```

则 Mermaid 必须使用：

```text
frame_progress_left_progressBar
```

不得继续使用旧名称。

---

### P1：插件导出的真实节点结构、Node 路径和关联组件关系

插件节点树代表当前 Figma 结构事实。

不得：

- 自行创造不存在的层级；
- 把关联组件误认为主组件真实子层级；
- 为了简化而删除用户提供的关键父子链路。

---

### P2：Figma 变体状态 / 插件状态快照（若存在）

两者都是可选的状态事实来源。

#### P2-A：Figma 变体（Component Set）

插件 v9.7+ 可以识别 Component Set。

规则：

- 必须保留“Figma 变体组件”的身份；
- 基准 Variant 的节点结构只读取一次；
- 其他 Variant 不重复完整节点树，只有节点新增、节点缺失或 `effectiveVisible` 变化才读取为业务 Delta；
- Variant 若只有颜色 / Fill、描边 / Stroke、透明度 / Opacity、阴影、圆角、坐标、尺寸或其他纯视觉变化，不自动视为交互状态；
- 纯样式 Variant 的具体用途由交互说明或 `变体解释` 补充；
- 用户填写的 `变体解释`（如常态、悬浮态、按下态、禁用态）是明确的业务语义，应优先采用；
- Variant 名称若只是技术编号，不得自行猜含义；
- 跨 Variant 对应节点按“相对层级路径 + 节点类型 + 同级同名出现序号”理解，不依赖 Node ID；
- Component Set 中某个 Variant 根组件自身在 Figma 画布里的 `visible` 不参与内部业务显隐继承，不能据此把该 Variant 的所有内部节点判断为业务隐藏。

已有 Variant 已完整表达的状态，不要求再次录制同义状态快照。

#### P2-B：状态快照

状态快照是**可选的复杂状态辅助工具**，不是交接必填项。

有快照时优先用于确定：

- 显示 → 隐藏
- 隐藏 → 显示
- 当前状态与基准状态之间的显隐 Delta
- 父级隐藏后后代节点的有效显隐

插件 v9.4+ 同时区分：

```text
rawVisible       = 节点自身 Figma visible
effectiveVisible = 节点自身 visible AND 所有祖先均有效显示
```

Mermaid 的业务显隐使用 `effectiveVisible`。

因此：

```text
父级隐藏
→ 子级即使自身 rawVisible=true
→ 业务上仍视为隐藏
```

插件 v9.5+ 的状态树还有以下显示规则：

- 当前组件根节点不在快照树中重复显示；
- 父级隐藏导致的后代有效隐藏仍然保留，不做父级压缩；
- `显示 / 隐藏 / Delta` 使用真实节点树表达；
- `[结构路径]` 只是为了保留真实层级，不代表该父级本身属于当前显示 / 隐藏集合；
- 状态树中的节点顺序严格继承原始 Figma 节点树顺序，不得因为显隐筛选而重新排序。

**状态快照为 0 不代表资料不完整。** 简单状态可以直接在交互说明中写明显隐。

---

### P3：状态补充 + 交互说明

主要用于补充 Figma 静态状态无法表达的信息：

- 状态进入条件
- 状态离开条件
- Percent / Progress
- 动态数字
- 动态文本
- 列表内容
- 玩家头像
- 图片 / 材质切换
- 动画
- 播报结束后再显示等时序关系
- “实际值 / 0 / 空列表”等运行时数据语义

---

### P4：节点树中的当前 Figma 显隐

节点树可能输出：

```text
[当前Figma：隐藏]
```

该标记只代表**导出瞬间节点自身** `visible=false`。

它不等于：

```text
业务默认隐藏
初始化必须隐藏
该状态下必然隐藏
```

不得仅凭 `[当前Figma：隐藏]` 写入 Mermaid 的初始化或状态逻辑。

---

### P5：规范默认规则

仅用于补足写法，不得覆盖明确业务信息。

---

# 3. 插件 v10.10+ 的角色

插件不是 Mermaid 生成器。

插件负责采集和整理 **事实数据**：

```text
Figma 真实节点
+
节点中文作用
+
节点备注
+
组件边界
+
关联组件
+
Figma 变体 / 变体解释
+
状态快照
+
状态显隐差异
+
交互说明
```

Mermaid 转写负责把这些事实组织成：

```text
初始摆放
+
状态 / 交互
+
动态值
+
时序
+
组件之间的关系
```

---

# 4. 插件工作区结构

一个完整交互工作区定义为：

```text
1 个主组件
+
0~N 个关联组件
+
各组件自己的节点备注 / 状态快照
+
1 份共享交互说明
```

例如：

```text
主组件：
frame_hud_erosion_contention

关联组件：
frame_hud_erosion_reward
frame_hud_erosion_avatar
hud_common_tips_buff_04
```

---

# 5. 主组件与关联组件规则

## 5.1 主组件和关联组件是独立节点树

必须理解为：

```text
主组件 A
关联组件 B
关联组件 C
```

而不是：

```text
A
└─ B
   └─ C
```

除非插件真实节点树明确显示为这种父子关系。

---

## 5.1.1 关联组件关系说明

插件 v9.3+ 可为关联组件填写关系说明，例如：

```text
上游调用主组件
主组件调用
关联组件内部复用
```

该字段用于帮助理解调用方向和上下文。

但它只是**关系说明**，不能覆盖节点树事实。若关系说明与真实结构冲突，应指出冲突。

当前 Design 关联组件与外部 Design 关联组件在业务语义上地位相同。跨 Design 来源信息只用于定位资料；不得因为来源不同而虚构父子层级、改变调用方向或降低外部组件的业务权重。

---

## 5.2 子组件边界

v9.1 中：

> 当前组件内部遇到 Figma `INSTANCE` 子组件时，只记录该子组件实例本身，并停止继续递归。

例如真实结构：

```text
frame_reward
└─ frame_hud_erosion_reward
   └─ frame_gain
      ├─ img_gain_money
      └─ txt_gain_num
```

主组件中只应理解为：

```text
frame_reward
└─ frame_hud_erosion_reward
```

`frame_hud_erosion_reward` 内部：

```text
frame_gain
├─ img_gain_money
└─ txt_gain_num
```

应从它自己的关联组件章节读取。

### Mermaid 规则

主组件可以描述：

```text
frame_reward 的列表项调用 frame_hud_erosion_reward
```

但不要在主组件初始化中再次完整展开关联组件内部所有层级。

需要说明关联组件内部结构时，在对应关联组件 participant / Note 中单独说明。

---

# 6. 锁定节点与忽略节点

## 6.1 Figma 锁定节点

插件已过滤：

- 锁定节点
- 锁定节点的整棵子树

这些内容默认：

```text
不进入节点树
不进入状态 Delta
不进入最终 Mermaid
```

除非用户当前消息明确要求重新加入。

---

## 6.2 “忽略”节点

插件中的“忽略”本质表示：

> 该节点通常是固定背景、装饰、固定文案等，不需要作为业务控件进入交接。

插件 v10.10+ 的“忽略 / 恢复”统一为整棵子树语义：

```text
忽略某节点
= 当前节点 + 全部后代节点一起忽略

恢复某节点
= 当前节点 + 全部后代节点一起恢复
```

被忽略的整棵子树：

- 不进入节点说明；
- 不参与状态 Delta；
- 不参与 Variant Delta；
- 不作为 Mermaid 业务控件；
- 不参与交互说明引用检查中的有效业务节点集合；
- 不因存在后代而把忽略父级保留为特殊“结构路径”。

若交互说明仍引用已随祖先一并被忽略的真实节点，应报告冲突并提示恢复该节点及其全部后代；不得绕过忽略规则直接写入业务 MMD。

---

## 6.3 备注匹配状态仅用于诊断

插件内部可能出现：

```text
matched
recovered
manual
ambiguous
new
```

这些值只描述备注 JSON 迁移 / 恢复的匹配结果。

它们：

- 不得进入 Mermaid；
- 不得解释为业务状态；
- 不得影响节点职责判断；
- 不得改变节点显隐或 Variant 语义。

若存在 `ambiguous`，应先依据插件诊断或用户确认解决节点映射，不得把“有歧义”本身画成状态。

---

# 7. 中文作用规则

## 7.1 中文作用不是所有节点必填

以下节点通常应填写：

- 程序控制显隐
- 动态文本
- 动态数值
- ProgressBar
- 列表
- 按钮
- 玩家头像
- 图片 / 材质切换
- 状态节点
- 重要业务容器
- Mermaid 中会被引用的节点

纯静态装饰可以不填。

---

## 7.2 已填写中文作用必须原样尊重

例如插件提供：

```text
frame_avatar_left = 我方参与争夺玩家头像列表
```

不得擅自改写成：

```text
我方头像
```

如果用户提供了明确的“节点名 → 中文作用”映射，该映射视为权威字典。

当该节点被选为 participant 时，`participant ... as` 中的中文作用必须从权威字典逐字复制。不得概括、缩写、改换语序、替换同义词或为了句子更自然而润色。

---

## 7.3 中文作用与备注的分工

两者不是重复字段。

### 中文作用

回答：

> 这个节点是什么 / 负责什么。

应尽量短、稳定，例如：

```text
frame_buff = 影响来源排列区域
txt_attribute_num = 属性差值文本
img_head = 英雄头像图片
```

### 备注

回答：

> 这个节点还有什么实现、资源、材质、调用关系或特殊业务规则需要知道。

例如：

```text
frame_buff
中文作用：影响来源排列区域
备注：调用 frame_hud_dynamic_attribute_list；用于排列英雄头像及对应技能/装备图标。
```

转写时：

```text
中文作用 → participant 中文职责 / 节点语义
备注     → Note、资源配置、组件调用、特殊限制
```

不得把“备注”错误当成中文作用，也不得要求中文作用承载全部实现细节。

---

# 8. 真实节点名规则

## 8.1 禁止抽象化替代真实节点

错误：

```text
刷新进度
刷新百分比
更新头像
```

正确：

```text
frame_progress_left_progressBar 的 Percent 显示实际争夺进度
txt_time_progress_left 显示实际争夺进度百分比
frame_avatar_left 显示实际参与争夺的我方玩家头像
```

---

## 8.2 必须保留必要父子链路

如果插件提供：

```text
frame_left
└─ frame_progress_left
   └─ frame_progress_left_progressBar
```

需要表达结构时，应保留：

```text
frame_left → frame_progress_left → frame_progress_left_progressBar
```

不得直接只剩：

```text
frame_progress_left_progressBar
```

除非状态段只是在引用一个已经于初始化阶段定义过的叶子节点。

---

## 8.3 Figma 名与最终工程名冲突

最终工程控件名优先。

例如当前侵蚀点已确认：

```text
旧理解：
img_progress_left
img_progress_right

UE 实际：
frame_progress_left_progressBar
frame_progress_right_progressBar
```

以及结算：

```text
frame_finish_left
└─ frame_finish_left_progressBar

frame_finish_right
└─ frame_finish_right_progressBar
```

这类映射必须使用最终工程名。

### 禁止行为

不得根据命名规律自行推导：

```text
看到 frame_xxx
→ 猜测一定存在 frame_xxx_progressBar
```

只有用户或交接资料明确提供时才能使用。

---

# 9. Mermaid participant 规则

## 9.1 participant 选择

participant 应代表：

- 主业务组件
- 关联业务组件
- 重要业务区域
- 有独立交互职责的控件区域

不要求每个叶子节点都成为 participant。

例如：

```mermaid
participant Contention as 侵蚀点争夺组件<br/>(frame_hud_erosion_contention)
participant Left as 我方区域<br/>(frame_left)
participant Right as 敌方区域<br/>(frame_right)
participant Reward as 奖励区<br/>(frame_reward)
```

若 `frame_reward` 已有中文作用，`奖励区` 位置必须逐字使用原值；participant Alias 可以调整，但真实节点名和中文作用都不能改写。

叶子节点通常写在消息内容中：

```text
Left->>Left: frame_progress_left_progressBar 的 Percent 显示实际争夺进度
```

---

## 9.2 participant 显示格式

推荐：

```text
participant Alias as 中文职责<br/>(真实节点名)
```

例如：

```text
participant Reward as 奖励区<br/>(frame_reward)
```

---

# 10. 初始摆放阶段

## 10.1 必须保留

所有正式 MMD 默认必须包含：

```mermaid
rect rgb(240,240,240)
Note over ...: 初始摆放阶段（组件初始化时摆好一次）
...
end
```

“初始摆放阶段”不能因为状态快照存在而删除。

---

## 10.2 初始阶段负责说明

只写一次的静态事实优先放这里：

- 主组件结构
- 重要业务区域
- ProgressBar 对应层级
- 列表项调用哪个组件
- 图片 / 材质资源
- Buff 组件
- 默认隐藏
- 默认显示
- 关联组件用途
- 固定资源映射

例如：

```text
frame_left 下摆出 frame_progress_left
frame_progress_left_progressBar 作为我方争夺进度条
txt_time_progress_left 显示我方争夺进度百分比
```

后续状态不需要反复解释“它是什么”。

## 10.3 初始阶段禁止运行时条件

初始摆放阶段不得出现运行时进入条件、离开条件、触发时机或因果判断。以下表达无论资料是否明确提供，都必须放在 `end` 之后的对应状态前：

```text
当……时
未满足……时
玩家死亡时
受到影响时
出现条件 / 消失条件
触发后 / 变化时
```

初始化可以写“资料明确要求默认隐藏某节点”，但不能写“未满足某运行时条件时不显示某节点”。两者不是同一个事实。

---

# 11. 状态快照规则

## 11.1 状态快照是可选的复杂显隐工具

状态快照不是每个组件、每个状态都必须使用。

### 简单显隐

例如：

```text
技能状态：只显示 img_skill，隐藏 img_equip、frame_head
装备状态：只显示 img_equip，隐藏 img_skill、frame_head
头像状态：只显示 frame_head，隐藏 img_skill、img_equip
```

这种只有少量节点的互斥规则，直接写交互说明更高效，不需要强制录快照。

### 复杂显隐

以下情况更适合快照：

- 一个状态有大量节点同时变化；
- 多个区域联动；
- 父子层级较深；
- 状态数量多；
- 结果状态复杂；
- 后续可能频繁修改。

插件记录一个复杂 Figma 状态后，可以得到相对基准的有效显隐 Delta。

例如：

```text
状态：我方获胜
对比：争夺中基础状态

frame_progress_left：显示 → 隐藏
frame_finish_left：隐藏 → 显示
frame_reward：隐藏 → 显示
```

Mermaid 应吸收这些 Delta。

### 父子显隐继承

如果：

```text
Parent
├─ ChildA
└─ ChildB
```

Figma 中只关闭 Parent 的眼睛，而 ChildA / ChildB 自己的眼睛仍为开启，插件内部可能记录：

```text
Parent.rawVisible  = false
ChildA.rawVisible  = true
ChildB.rawVisible  = true
```

但业务有效显隐必须是：

```text
Parent.effectiveVisible = false
ChildA.effectiveVisible = false
ChildB.effectiveVisible = false
```

Mermaid 不得输出“父级隐藏、子级显示”。

状态计数、完整状态、Delta 与 AI 交接均以**有效显隐**为准。

---

## 11.1.1 状态快照树的展示语义

插件 v9.5+ 的快照显示必须按真实节点树理解。

例如：

```text
隐藏：
frame_parent
├─ img_a
└─ img_b
```

表示父级和后代在该状态下均为有效隐藏。

如果出现：

```text
隐藏：
frame_right [结构路径]
└─ img_d
```

则 `frame_right` 只用于说明 `img_d` 的真实父级路径，**不得理解为 frame_right 也隐藏**。

此外：

- 当前组件根节点不会在快照内容里重复显示；
- 父级隐藏后，子级有效隐藏仍全部保留；
- 状态树节点顺序必须严格继承原始 Figma 节点树顺序。

---

## 11.2 不重复输出未变化节点

如果一个状态相对于基准：

```text
frame_left 无变化
frame_right 无变化
frame_money 无变化
```

无需重复写。

使用：

> 基础状态 + 差异（Delta）

而不是每个状态重新复述完整 UI。

---

## 11.3 基准状态与当前状态是两个概念

插件 v9.1 中：

```text
baselineState = Delta 对比基准
activeState   = 当前正在查看 / 最近记录状态
```

转写只关心状态之间的实际比较关系。

不得因为某状态被标记为“基准”，就错误理解为所有业务流程一定从该状态开始。

---

# 11A. Figma 变体规则

## 11A.1 变体组件必须明确标识

若插件输出：

```text
组件类型：Figma 变体组件（Component Set）
```

转写时必须保留这一事实。

不能因为插件只展示一个基准 Variant 的节点树，就把该组件误认为普通 COMPONENT。

---

## 11A.2 基准结构只读取一次

Component Set 中可能包含多个 Variant，每个 Variant 在 Figma 中拥有一套独立节点树。

插件为了避免重复，会：

```text
基准 Variant → 完整节点结构只列一次
其他 Variant → 只列节点新增 / 节点缺失 / effectiveVisible Delta
```

Mermaid 不得重新把每个 Variant 的完整树复制一遍。

---

## 11A.3 哪些 Variant 才属于交互状态

只有以下差异可作为程序相关 Variant 状态：

```text
新增节点
当前 Variant 缺失节点
effectiveVisible 变化
```

若只有：

```text
颜色 / Fill
描边 / Stroke
透明度 / Opacity
阴影
圆角
坐标
尺寸
其他纯视觉变化
```

则默认视为**纯样式 Variant**，不自动展开为 Mermaid 状态。

若这些样式变化对交互说明有意义，由交互说明明确说明具体层级的调整即可。

跨 Variant 节点匹配必须基于：

```text
相对层级路径
+ 节点类型
+ 同级同名出现序号
```

例如同一父级下的三个同名 `Rectangle` 应按 `Rectangle#1 / #2 / #3` 对应，不能使用 Node ID，也不能因重复名字错位而制造虚假显隐 Delta。

另有一条独立规则：

> Component Set 中某个 Variant 根组件自身在 Figma 画布里的 `visible`，不应导致其内部所有节点被判断为业务隐藏。

Variant 根组件只是 Figma 用于承载该变体的一层容器；内部节点的业务显隐比较从 Variant 内部结构开始。

---

## 11A.4 变体解释

插件 v9.9+ 支持为每个 Variant 填写“变体解释”。

例如：

```text
State=Default：常态
State=Hover：悬浮态
State=Pressed：按下态
State=Disabled：禁用态
```

转写时：

- Variant 技术名用于定位；
- 变体解释用于理解业务语义；
- 若技术名与解释冲突，优先采用用户最新修正，其次采用明确的变体解释；
- 不得从 `State=1 / State=2` 自行猜“常态 / 悬浮态”。

纯样式 Variant 即使有“悬浮态”等解释，也不因此自动生成业务状态；其样式变化仍由交互说明补充。

---

## 11A.5 Variant 与状态快照的使用优先级

推荐：

```text
已有 Figma Variant 且能表达业务状态
→ 直接使用 Variant

无 Variant + 简单状态
→ 直接写交互说明

无 Variant + 复杂状态
→ 使用状态快照
```

Variant 与状态快照不是必须重复记录的两份状态资料。

---

# 12. 状态描述标准结构

推荐从交接资料提取为：

```text
【状态名称】

【进入条件】
...

【继承 / 对比】
...

【显隐变化】
...

【动态变化】
...

【持续刷新】
...

【时序 / 动画】
...

【离开条件】
...
```

并非每个状态都必须有全部字段。

---

# 13. 状态编号与排列

最终 MMD 默认使用：

```text
状态1
状态2
状态3
...
```

不要使用大量 UML：

```text
alt
opt
```

来取代业务状态。

---

## 13.1 状态不代表一定按编号顺序发生

对于平行状态必须明确说明。

例如：

```mermaid
Note over A,B: 以下状态3/4/5均为争夺中的不同表现，不代表必须依次发生
```

对于互斥结果：

```mermaid
Note over A,B: 状态7/8/9为三种不同结算状态，无先后顺序
```

---

## 13.2 平行状态排序

为了可读性，优先按照：

```text
从空到有
从简单到复杂
从基础到特殊
```

例如：

```text
双方均未争夺
→ 仅一方争夺
→ 双方争夺
```

此顺序仅用于阅读，不表示强制状态迁移。

---

# 14. 叠加状态

有些状态不是独立替换，而是叠加在当前状态上。

例如：

```text
即将超时
```

可能叠加在：

```text
双方未争夺
仅一方争夺
双方争夺
```

之上。

应写：

```text
txt_overtime 显示
其余层级沿用当前争夺状态
```

而不是重新定义整个界面。

---

# 15. 动态数据规则

Figma 快照不能完整表达运行时数据。

以下内容必须从“状态补充 / 交互说明 / 当前修正”中读取：

## 15.1 ProgressBar

明确写：

```text
xxx_progressBar 的 Percent = ...
```

不要只写：

```text
进度条显示 xx%
```

例如：

```text
frame_progress_left_progressBar 的 Percent 显示实际争夺进度
```

---

## 15.2 百分比文本

ProgressBar 的 Percent 和文本是两个不同控件。

例如：

```text
frame_finish_left_progressBar.Percent = 100%
txt_progress_finish_left = "99%"
```

两者可以不同。

不得因为 ProgressBar 为 100% 就自动把文本改成 100%。

---

## 15.3 列表

“无数据”默认理解为：

```text
列表显示为空
```

不是：

```text
隐藏整个列表
```

除非需求明确说隐藏。

例如：

```text
frame_avatar_left 无玩家参与
→ 头像列表显示为空
```

---

## 15.4 图片 / 材质 / 图标

如果资料明确：

```text
icon_hero 使用 MI_Hero_Avatar
```

必须保留真实资源名。

不得改成：

```text
使用头像材质
```

---

# 16. 显示 / 隐藏规则

## 16.1 有状态快照时

复杂显隐直接按快照的**有效显隐**写。

父级隐藏时，后代节点也按隐藏处理，不得依据子节点自身 raw visible 写成显示。

---

## 16.2 无状态快照或快照未覆盖时

交互说明明确提供的简单显隐规则直接使用。

例如：

```text
只显示 img_skill，隐藏 img_equip、frame_head
```

本身就是完整、有效的交接信息，不需要再要求补状态快照。

---

## 16.3 不得自行脑补

如果某状态只说明：

```text
显示 frame_finish_left
```

没有说明 `frame_reward`，

且状态快照也没有 `frame_reward` 变化，

则不得自行判断奖励应该显示或隐藏。

应保留已知信息，必要时指出缺口。

---

# 17. 箭头写法

## 17.1 组件内部更新

使用自指：

```mermaid
Left->>Left: txt_time_progress_left 显示“0%”
```

---

## 17.2 父区域控制子区域

例如：

```mermaid
Contention->>Left: 显示 frame_finish_left
```

---

## 17.3 组件之间调用 / 时序

例如：

```mermaid
Broadcast05->>Contention: 播报结束后显示 frame_hud_erosion_contention
```

---

## 17.4 一条箭头尽量表达一个动作组

可以使用 `<br/>` 合并同一个逻辑组，例如：

```mermaid
Left->>Left: frame_progress_left_progressBar 的 Percent 为0<br/>txt_time_progress_left 显示“0%”
```

但不要把互不相关的 5~10 个操作全部塞在一条消息里。

---

# 18. Note over 使用规则

适合：

- 初始摆放标题
- 状态标题
- 平行状态说明
- 互斥状态说明
- 资源说明
- 组件内部结构说明
- 动效说明
- 无先后顺序说明

例如：

```mermaid
Note over Left,Right: frame_avatar_left / frame_avatar_right 列表项调用 frame_hud_erosion_avatar
```

---

# 19. 交互说明与节点引用

插件交互说明区支持：

```text
`frame_reward`（奖励展示区域）
`txt_gain_num`（奖励数量文本）
```

这种“真实节点名 + 中文作用解释”引用。

转写时：

- 反引号内的内容是权威真实节点名；
- 全角括号内的内容只是中文作用解释；
- 不得把括号中的中文作用当作控件名、节点 ID 或新的 participant 身份；
- 结合其所属主组件 / 关联组件判断上下文；
- 若交接检查提示跨组件重名，不得仅凭节点名猜所属组件；
- 根据交互说明所在语句和组件节点树确定。

例如：

```text
`img_progress_left`（我方争夺进度条）
```

应解析为：

```text
真实节点：img_progress_left
中文作用：我方争夺进度条
```

Mermaid 中仍必须保留 `img_progress_left`。

---

# 20. 插件 `@` 补全与搜索只是输入辅助

插件支持：

```text
@money
@gain
@奖励数量
Ctrl + Space
```

用于找到真实节点。

这些搜索关键词本身不属于 Mermaid 语义。

Mermaid 只使用最终插入的真实节点名：

```text
`img_gain_money`
```

---

# 21. 状态快照 + 交互说明的职责分工

两种输入方式都合法：

### 方式 A：简单状态直接写交互说明

适用于少量节点、规则清晰的显隐：

```text
只显示 A，隐藏 B、C
```

无需状态快照。

### 方式 B：复杂状态使用快照 + 交互说明补充

#### Figma 状态快照负责

```text
有效显示
有效隐藏
复杂整体静态状态
相对基准状态的显隐 Delta
父级隐藏带来的子级有效隐藏
```

#### 交互说明 / 状态补充负责

```text
触发条件
Percent
动态文本
动态数值
列表内容
头像内容
图片切换
材质切换
动画
播报时序
状态离开条件
```

对于复杂状态，交互说明不需要重复快照已经记录的大量显隐。

对于简单状态，可以完全不录快照，直接在交互说明中把显隐写清楚。

`Figma 状态快照合计：0 个` 不属于错误、警告或缺失。

---

### 方式 C：已有 Figma Variant

若设计师已经将状态做成 Component Set：

```text
优先读取 Variant 身份 + 变体解释 + 节点新增/缺失/effectiveVisible Delta
```

不再要求为了同一状态重复录快照。

纯样式 Variant 不展开成业务状态；需要说明的视觉调整直接写交互说明。

---

# 22. 状态变化的合并算法

转写一个状态时依次执行：

### Step 1：确定比较基准

读取插件状态：

```text
当前状态
对比基准
```

### Step 2：读取 Figma Variant（若存在）

若当前组件是变体组件，先读取：

```text
变体解释
结构 Delta
有效显隐 Delta
```

纯样式 Variant 不自动加入状态。

### Step 3：读取显隐规则

若有状态快照，读取**有效显隐 Delta**，例如：

```text
A：显示 → 隐藏
B：隐藏 → 显示
```

若没有状态快照，则直接读取交互说明中的明确显隐规则。

父级隐藏时，其后代业务显隐一律按隐藏处理。

### Step 4：读取状态补充

补：

```text
进入条件
Percent
文本
动画
```

### Step 5：读取共享交互说明

补充跨组件时序与业务关系。

### Step 6：删除重复描述

如果状态快照已经说明：

```text
frame_reward 隐藏 → 显示
```

交互说明又写：

```text
此时显示 frame_reward
```

最终只写一次。

### Step 7：检查冲突

如果快照写：

```text
frame_reward = 隐藏
```

交互说明写：

```text
frame_reward = 显示
```

不得擅自决定。

应指出：

```text
状态快照与交互说明冲突，需要确认
```

除非当前消息已有最新修正。

---

# 23. 初始状态与默认隐藏

节点树中的：

```text
[当前Figma：隐藏]
```

**不能单独证明初始化默认隐藏。** 它只表示导出瞬间节点自身的 Figma visible=false。

初始化默认显隐必须由以下至少一种信息明确支持：

- 交互说明；
- 状态快照中的基准 / 初始化状态；
- 用户当前消息中的最新确认。

如果节点在组件初始化时明确默认隐藏：

```text
frame_finish_left
frame_finish_right
frame_reward
txt_overtime
```

应在“初始摆放阶段”统一写一次。

后面的争夺状态如果始终保持默认隐藏，可以：

- 不重复写；或
- 在重要基础状态用 Note 简洁强调。

不要每个状态都机械复制同一串默认隐藏。

---

# 24. 结果状态

互斥结果状态应独立列出，例如：

```text
敌方获胜
我方获胜
平局
```

并在前面注明：

```text
三种结算状态无先后顺序
```

每种结果只写自身实际变化。

---

# 25. Mermaid 不应承担的内容

不要在 MMD 中：

- 发明 Blueprint API
- 发明 `SendAction`
- 发明 `OnUpdateUI`
- 发明事件名
- 发明变量名
- 发明数据来源
- 猜测程序架构
- 猜测 Figma 不存在的层级

除非输入资料明确提供。

---

# 26. 程序 API 与项目架构

如果未来项目文档明确提供：

```text
SendAction
OnUpdateUI
Mediator
View
```

可以按项目规范加入。

如果插件 TXT 和交互说明未提供，则不主动补。

控件交互图重点描述：

```text
谁
在什么状态
改变哪个真实控件
改变成什么
```

---

# 27. 交接检查处理

插件可能输出：

```text
未填写中文作用
引用不存在
引用了已忽略节点
跨组件同名节点
```

处理规则：

### 未填写中文作用
不等于不能使用。

如果交互说明明确引用该真实节点，可以照常写，但不要自行创造中文职责。

### 引用不存在
不得静默忽略。

应提示用户确认节点名。

### 引用了已忽略节点
如果用户明确在交互说明中引用，说明可能需要恢复对应子树为业务节点。

应优先提醒冲突，不要直接删除。

### 跨组件同名
结合所属组件和路径判断。

无法唯一确认时，应指出歧义。

### 已忽略节点审计清单

该清单用于检查是否误点“忽略”。

默认不得把审计清单中的节点重新写入业务 MMD。

### 正常组件本体 / INSTANCE 同名

若插件明确标记为正常组件引用，不视为冲突。

### 未展开 Variant

如果插件说明某 Variant“无节点新增 / 节点缺失 / effectiveVisible 差异”，默认视为纯样式或非业务差异，不自动生成状态。

### 变体解释

若存在，作为 Variant 的业务语义来源；不得忽略后再靠技术名自行猜状态含义。

---

# 28. 最终转写流程

收到：

```text
规范.md
+
xxx-ai-handoff.txt
+
可选最新修正
```

后，按以下顺序生成：

```text
1. 解析主组件
2. 解析关联组件及关系说明
3. 识别是否为 Figma 变体组件
4. 读取基准 Variant、变体解释、节点新增 / 节点缺失 / effectiveVisible Delta
5. 建立节点名 → 中文作用 → 备注 → 路径字典
6. 应用最新运行时 / UE 名称修正
7. 过滤 locked / ignored，并只把忽略清单当作审计信息
8. 确认子组件边界
9. 选 participant
10. 写初始摆放阶段
11. 解析状态快照（若存在），保留树顺序与 `[结构路径]` 语义
12. 合并状态补充
13. 合并共享交互说明
14. 合并重复显隐
15. 识别平行 / 互斥 / 叠加状态
16. 过滤纯样式 Variant，保留其变体身份与解释
17. 按状态1/2/3...排列
18. 检查 Percent / 文本 / 列表是否混淆
19. 检查真实节点名是否全部正确
20. 输出 sequenceDiagram
```

---

# 29. 输出前强制自检

生成 `.mmd` 前必须检查：

- [ ] 是否有 `sequenceDiagram`
- [ ] 是否有“初始摆放阶段”
- [ ] 初始阶段是否使用 `rect rgb(240,240,240)`
- [ ] 用户提供的真实节点名是否全部原样保留
- [ ] 是否错误使用了旧节点名
- [ ] 是否把关联组件误写成主组件内部真实树
- [ ] 子组件内部是否被重复展开
- [ ] 是否把未参与列表错误写成“隐藏”
- [ ] ProgressBar `Percent` 与百分比文本是否分开
- [ ] 若存在状态快照，是否按 effectiveVisible 正确合并
- [ ] 父级隐藏时是否错误保留了“显示”的子级
- [ ] 状态快照为 0 时是否错误判定资料不完整
- [ ] 是否把 `[当前Figma：隐藏]` 错当成业务默认隐藏
- [ ] 若组件为 Component Set，是否明确保留“变体组件”身份
- [ ] 是否重复展开了每个 Variant 的完整节点树
- [ ] 是否把纯样式 Variant 错误写成交互状态
- [ ] 跨 Variant 节点是否按相对层级路径 + 节点类型 + 同级同名出现序号对应
- [ ] 是否只把节点新增、节点缺失或 `effectiveVisible` 变化作为 Variant 业务 Delta
- [ ] 是否错误地让 Variant 根组件自身 `visible` 传播为全部内部节点业务隐藏
- [ ] 是否读取并尊重用户填写的“变体解释”
- [ ] 是否把 `[结构路径]` 错误理解为该父级本身也属于当前显隐集合
- [ ] 状态快照 / Variant 状态树是否严格保持原始 Figma 节点树顺序
- [ ] 是否把已忽略节点审计清单重新写进业务 MMD
- [ ] 忽略或恢复某节点时，是否同步作用于当前节点及全部后代节点
- [ ] 是否把 `matched / recovered / manual / ambiguous / new` 误写进 Mermaid 或业务状态
- [ ] `` `真实节点名`（中文作用） `` 是否始终以反引号内名称作为权威节点名
- [ ] 交互说明中的动态值是否已补充
- [ ] 平行状态是否注明“非强制顺序”
- [ ] 互斥结果是否注明“无先后顺序”
- [ ] 叠加状态是否使用“沿用当前状态”
- [ ] 是否自行发明 API / 事件 / 控件
- [ ] 是否存在交接检查未解决的节点歧义
- [ ] 是否存在状态快照与交互说明冲突

---

# 30. 推荐最终 MMD 骨架

```mermaid
sequenceDiagram
    participant Main as 主组件中文作用<br/>(frame_main)
    participant AreaA as 区域A<br/>(frame_a)
    participant Linked as 关联组件中文作用<br/>(frame_linked)

    rect rgb(240,240,240)
    Note over Main,Linked: 初始摆放阶段（组件初始化时摆好一次）

    Main->>AreaA: frame_a下摆出xxx<br/>xxx_progressBar作为xxx进度条
    Note over Linked: 关联组件内部结构与资源说明
    Main->>Main: 默认隐藏xxx
    end

    Note over Main,Linked: 状态1：xxx

    Main->>Main: ...

    Note over Main,Linked: 以下状态2/3/4为不同表现，不代表必须依次发生

    Note over Main,Linked: 状态2：xxx
    AreaA->>AreaA: ...

    Note over Main,Linked: 状态3：xxx
    AreaA->>AreaA: ...

    Note over Main,Linked: 状态5/6/7为互斥结果状态，无先后顺序

    Note over Main,Linked: 状态5：我方获胜
    ...
```

---

# 31. 当前侵蚀点案例中的已确认运行时命名示例

以下仅作为“Figma 名称与最终控件名可能不同”的示例，不作为所有组件的通用命名规律。

### 争夺 ProgressBar

```text
frame_left
└─ frame_progress_left
   └─ frame_progress_left_progressBar

frame_right
└─ frame_progress_right
   └─ frame_progress_right_progressBar
```

### 结算 ProgressBar

```text
frame_finish_left
└─ frame_finish_left_progressBar

frame_finish_right
└─ frame_finish_right_progressBar
```

已确认业务示例：

```text
我方获胜：
frame_finish_left_progressBar.Percent = 100%

敌方获胜：
frame_finish_right_progressBar.Percent = 100%

平局：
frame_finish_left_progressBar.Percent = 100%
frame_finish_right_progressBar.Percent = 100%
```

注意：

```text
ProgressBar.Percent = 100%
```

不代表：

```text
txt_progress_finish_left / right
```

必须显示 `100%`。

例如平局可以同时存在：

```text
frame_finish_left_progressBar.Percent = 100%
txt_progress_finish_left = "99%"
```

---

# 32. 插件 v10.10+ 使用约定（给交接人员）

## 32.1 主组件

在 Figma 中选中本次业务主组件。

插件读取：

```text
主组件节点树
中文作用
备注
```

---

## 32.2 纯装饰

固定背景、固定花纹、固定文案等无业务控制需求的节点：

```text
标记“忽略”
```

中文作用不是必填。

---

## 32.3 关联组件

主组件调用其他独立组件时：

```text
关联组件
→ 左侧“新增内部关联组件”或“新增外部关联组件”
```

每个关联组件单独整理，不与主组件节点树混写。

---

## 32.3.1 Figma 变体组件

如果组件本身已经做成 Component Set：

- 插件会明确标记“Figma 变体组件”；
- 基准 Variant 的节点结构只整理一次；
- 只有节点新增、节点缺失或 `effectiveVisible` 变化的 Variant 自动作为可用状态信息；
- 只有颜色、描边、透明度等样式变化的 Variant 不需要录快照，也不会自动展开为交互状态；
- 每个 Variant 可填写“变体解释”，例如：

```text
常态
悬浮态
按下态
禁用态
```

若纯样式 Variant 有需要说明的视觉变化，直接在交互说明里写“哪个层级有调整”即可。

---

## 32.4 状态快照

状态快照**按复杂度选择使用，不是必填步骤**。

简单状态：

```text
只显示 A，隐藏 B、C
```

直接写在交互说明中即可。

复杂状态：

```text
在 Figma 中摆好状态
→ 状态快照
→ 记录当前 Figma 状态
```

第一张可作为基准，后续状态自动比较有效显隐 Delta。

父级隐藏时，插件会把子级业务有效状态一并视为隐藏。

状态快照中的“显示 / 隐藏 / Delta”按原始 Figma 节点树顺序展示；`[结构路径]` 只表示父子路径，不表示该父级本身属于当前显隐集合。

当前组件根节点不在快照树里重复显示。

0 个状态快照不影响正常交接。

---

## 32.5 状态补充

只补 Figma 无法表达的信息：

```text
进入条件
Percent
动态文本
列表
动画
时序
```

---

## 32.6 交互说明

共享交互说明负责：

```text
跨状态
跨组件
动态逻辑
时序
```

需要真实节点时使用：

```text
@节点关键词
```

或：

```text
Ctrl + Space
```

有中文作用时最终插入：

```text
`真实节点名`（中文作用）
```

无中文作用时仍插入：

```text
`真实节点名`
```

反引号中的真实节点名是唯一权威标识；括号中的中文作用只用于解释。

---

## 32.7 最终交付

导出：

```text
完整交接 TXT
```

与本规范一起提供。

如果存在 UE 最终命名与 Figma 不一致，再额外补充：

```text
【最新修正】
Figma xxx → UE xxx
```

即可。

---

# 33. 最简使用指令

以后可以直接发送：

```text
附件1：UI控件交互图_Mermaid转写规范_v2.3.md
附件2：xxx-ai-handoff.txt

按规范将交接 TXT 转成最终 .mmd。
严格使用真实节点名；
Figma 变体组件要保留变体身份；只有节点新增、节点缺失或 effectiveVisible 变化的 Variant 读取为状态，纯样式 Variant 不自动展开；
变体解释用于理解常态 / 悬浮态 / 按下态等业务语义；
状态快照可选：有快照时使用有效显隐，父级隐藏则子级也视为隐藏；
状态树严格保持原始 Figma 节点顺序，`[结构路径]` 仅表示路径；
无快照时直接使用交互说明中的明确显隐规则；
`[当前Figma：隐藏]` 不等于业务默认隐藏；
交互说明负责触发条件、动态值、列表、材质与时序；
不要自行补充未提供的业务规则。
```

若另有最新修正，再追加：

```text
最新修正：
1. xxx
2. xxx
```

即可。

---

# 34. 核心原则总结

最终只需要记住 10 条：

1. **真实节点名优先，不能抽象改写。**
2. **中文作用描述节点职责；备注补充资源、材质、调用关系和特殊规则。**
3. **主组件与关联组件独立，子组件边界不重复展开；关系说明只辅助理解调用方向。**
4. **初始摆放阶段必须保留。**
5. **Figma Component Set 必须保留变体身份；基准结构只写一次。**
6. **只有节点新增、节点缺失或 effectiveVisible 变化的 Variant 才自动作为状态；纯样式 Variant 不自动展开，变体解释负责业务语义。**
7. **状态快照可选：复杂状态用有效显隐快照，简单状态可直接写交互说明；父级隐藏则子级有效隐藏。**
8. **状态快照 / Variant 状态树严格继承原始 Figma 节点顺序；`[结构路径]` 只表示路径。**
9. **ProgressBar、文本、列表是不同控件，不能混为一个概念。**
10. **不确定就暴露缺口，不自行脑补业务规则。**
