# IELTS 复盘与刻意练习系统：架构

## 分层与依赖方向

```text
src/App.jsx                        路由入口：/ielts/* 懒加载
        ↓
src/features/ielts/IeltsApp.jsx    页面分发 + Provider
        ↓
pages / components / context       界面、交互、发送前确认
        ↓
domain / data                      录题、判题编排、题库与知识库
        ↓
core                               纯 JS 引擎（无框架依赖）  ←── mcp/（本地 MCP 服务）也只调它

ai                                 模板注册、模型调用、模拟输出
        ↘
src/services/storage/*             浏览器本地持久化

mcp/server.js + tools.js + store.js  本地 MCP 服务：宿主模型调用工具，数据写到本机文件夹
skills/ielts-review/SKILL.md       教宿主模型“怎么复盘”的技能
api/ielts/llm.js                   可选同源中转，复用 ai/templates.js
scripts/ielts-*-harness.mjs        复用模板与写作路径导出插件定义
```

依赖原则：

- `core/` 只能引用同目录文件；不引用 React、DOM、localStorage、网络或站内其他模块。测试会扫描 import 与浏览器 API 名称。
- 页面不直接拼模型 prompt；所有调用走 `invokeTemplate(templateId, variables)`。
- 整套归组、Markdown 报告、SRS 排期和证据校验都是纯领域函数；页面只持久化状态并渲染结果。
- 页面不直接操作 `localStorage`；雅思数据走 `IeltsStore`，错题走 `MistakesStore`。
- `/api/ielts/llm` 与对话插件导出都只消费同一份模板注册表和写作路径定义，不维护第二份 prompt/命令事实源。

## 关键取舍

### 一个懒加载路由，内部轻量分发

`/ielts/*` 由单个 `IeltsApp` 懒加载 chunk 承载，避免多个页面各自产生重复公共代码。主入口只增加路由字符串和 lazy 工厂；雅思页面、模板、数据和组件全部进入独立 chunk。E2E 同时检查 375px 与明暗主题。

### 确定性判题与大模型职责分离

判题、格式、单复数/拼写诊断、Band 换算、路径解锁、证据校验全部在 `core/`，不依赖网络。模型只产出解释和错因建议。规则已确定的错因优先于模型建议；界面用“规则判定 / 模型建议 / 推断 / 用户修正”区分来源。

### 模板注册表是唯一 prompt 入口

每个模板有稳定 id、语义版本、变量列表、JSON Schema 输出结构和不可移除约束。调用前检查缺变量；输出校验失败自动重试一次；再失败返回明确错误状态。发送对话框在请求前展示完整消息和字符数。

模板版本历史保存在注册表内。`ielts.reading.explain` v1.1.0 增加 `causeBasis`；v1.0.0 历史定义只用于离线回归和复现，不参与新请求。

### 整套复盘与报告

复盘摘要保存来源标签、Passage/Part 编号、实际用时和逐部分统计。`domain/testSets.js` 以“模块 + 去除编号的来源标签”归套，每部分取最近一次记录；缺段不补造、不估分。`/ielts/sets` 提供正确率、用时、错因、估算趋势、Markdown 导出和打印样式，报告不复制全文。

### 间隔复习

`domain/spacedRepetition.js` 负责 1/3/7/14/30 天排期和今日队列；错题、替换库与收藏词块共用 `irl-ielts-review-schedule`。排期只保存来源 id、阶段、到期日、评分历史，不复制原文。`/ielts/review` 先隐藏答案再评分，入口页显示今日到期内容。完整规则见 `docs/ielts/REVIEW_AND_AUDIT.md`。

### 模型审计与复现

`ai/auditLog.js` 接收 `invokeTemplate` 每次尝试的脱敏事件，最多保留 100 条；只记录模板/版本/状态/结构校验、截断输出和变量长度，不记录 key、prompt 或输入全文。成功后由 Provider 计算引用校验并回写 `ok/missingCount`。设置页导出复现包，不包含密钥或源文；`ielts:check-template-versions` 离线验证固定样例的两个模板版本。

### 无 key 仍完整可用

无 key 时：

- 判题、错题库、归因统计、词块、收藏、计时、写作路径锁定照常工作。
- 模型操作打开发送前对话框；用户可主动选择模拟反馈，或去设置页配置 key。
- 模拟反馈从 `meta.mock=true` 到 UI badge 都有明确标记，不能冒充真实讲解。
- 模拟数据只用于演示和测试，不写入模板注册表冒充真实结果。

### 本地优先与数据边界

- 目标分、严格度、服务商、模型、key、复盘摘要、错题、写作/口语记录、知识笔记、词块和替换库都在用户浏览器。
- API key 与学习数据分开导出；导出的 JSON 明确删除模型 key 与 TTS key。
- 原文/文稿默认不写入错题库。未勾选“保存全文”时只保存讲解所需定位片段；勾选后可在设置页逐篇删除。
- “清空雅思数据”删除雅思数据与雅思错题，但保留算法课后题进度。

### API key 安全边界

默认浏览器直连兼容 OpenAI Chat Completions 的服务商。请求头中的 key 只发给用户选择的服务商，不经过本站。

可选 `/api/ielts/llm` 中转：

- 只接受注册模板 id，变量必须齐全。
- 请求体最大 100 KB，单变量 30 KB，总文本 80 KB；30 秒超时。
- 不持久化、不打印请求体、不记录 key、原文或模型输出。
- 只允许 HTTPS 上游并拒绝 localhost/常见私网地址，降低 SSRF 风险。
- `vercel.json` 在 SPA catch-all 之前显式保留 `/api/*`。

### 错题存储迁移

`MistakesStore` 以 `irl-mistake-records` 为统一记录源，保留旧键：

- `algoviz-wrong-questions` → 算法错题索引记录。
- `algoviz-quiz-scores` → 算法分数摘要。

迁移幂等、无损并保留旧键；算法写入同时更新统一记录与旧键镜像，旧版本页面仍能工作。个人主页与 Quiz 通过兼容 API 继续读取/写入，不再直接访问 localStorage。

### 对话插件导出

`npm run ielts:export-harness` 生成 `dist-harness/ielts/system-prompt.md` 和 `commands.json`。`npm run ielts:check-harness` 重新从模板注册表和写作路径构造内容并逐字节比较，防止网页版与插件定义漂移。

## 主要目录

```text
src/features/ielts/
├── core/               公共纯函数、固定类型与单测
├── data/               错因、原创示例、词块、写作知识、口语话题、规则来源
├── domain/             粘贴拆题、整篇判题、弱点画像、错题记录映射
├── ai/                 模板注册、模型调用、模拟反馈、TTS 扩展点
├── context/            设置、模型发送确认、错题/词块状态
├── components/         通用 UI、计时、录题编辑、Markdown
└── pages/              总览、阅读、听力、错题、整套、今日复习、写作、口语、词块、设置
```

## 已知边界

- 原文/文稿只做空白与大小写归一化后子串校验，不做语义相似定位；这是有意的严格取舍。
- 本地数据没有加密。任何保存在 localStorage 的个人数据都可被同浏览器的脚本读取；不要在共享设备保存敏感材料。
- 浏览器直连服务商是否允许 CORS 取决于服务商；不允许时可切换同源中转。
- 第三方 TTS 只预留 endpoint/key 与调用接口，当前默认使用浏览器语音。
- 阅读/听力整卷估算要求同一来源标签系列完整录入；不足时不展示分数，避免用不完整样本编造成绩。
- 间隔复习目前只在单浏览器持久化，未做跨设备同步；模板审计日志是质量诊断而非考试证据。


## v0.3 合并与新增（2026-10-27）

### 来源

三份独立实现（内部代号 arch / bark / cane）择优合并：

- **底座：cane**。内核最紧凑、公开接口回归最完整（隐藏回归 46/47，答案格式 `cat`、`10 20` 判定正确），功能目录自成一体，最容易独立成仓库。
- **词块：三份合并去重**。按英文表达去重，从 81 条扩到 222 条，全部原创。
- **修复**：三份都把 `three hundred and twenty` 算成 4 个词。现在英文写全的数字（含 `and` 连接、连字符）计为一个数字；`judgeAnswer` 与 `validateAnswerFormat` 共用同一套字数规则，不再各写一份。

### 录入提速（蓝图 P0-1）

- **题集库**：同一本书同一篇的原文、题目、答案册存一次（键 `irl-ielts-materials`，只在本机），重做时载入，只填这次答案。不存用户答案。
- **答案速记** `core/answerLine.js`：`1 TRUE 2 NG 3 car park 4 B` 一行拆成逐题答案。题号只在“是下一题且当前题已有内容”时才开新题，所以数字答案（`5 320`）和恰好等于下一题号的答案（`5 6 6 B`）不会被拆错。T/F/NG/Y/N 只在判断题里展开，而且不跨标签体系（TFNG 题写 Y 仍按 Y 判，规则照常记 WRONG_LABEL_SET）。判题本身仍不接受缩写。

### 归因：用户点、模型补（P0-2）

- 错题不必等模型讲解就能选错因；用户选的记为“你确认的错因”（`causeBasis: 'user'`）。之后的模型讲解只把建议记在 `modelCause`，不覆盖用户的选择；规则判定的错因也不被覆盖。
- 听力快捷标签：听成了 / 没听到 / 不认识这个词 / 被改口骗了 / 跟丢题号 / 没跟上谁说的 / 写不完 / 拼错。点一下同时写入反思和建议错因。
- 错因表新增：阅读“读题失误”；听力“定位丢失”“读题失误”“主语追踪”。旧记录的错因字符串不变，统计照常。
- 本篇小结的错因占比改为读取用户确认后的错因，避免“有错题却显示待归类”。

### 北极星指标：同类错误复发率

`core/recurrence.js`：某个错因第一次出现后，之后**同模块的每一次复盘**里它是否再出现。全对的复盘也算“没复发”，所以调用方必须传入全部复盘，而不是只传有错题的。同时给最近 5 次的复发率，让下降趋势先于累计值显现。错题页和 MCP `weakness` 都用它。

### 本地 MCP 引擎（蓝图 §9）

- 零依赖、stdio、换行分隔的 JSON-RPC 2.0。只实现 `initialize`、`ping`、`tools/list`、`tools/call`；不依赖 sampling（服务器从不反向调用模型）。
- 规则写进工具，不写进提示词：`ingest_passage` 校验题号连续、标签合法、答案对得上；`judge_set` 是唯一判对错的地方；`submit_explanation` 逐字校验引用、错因必须在表内；校验失败以 `isError: true` 的工具结果返回问题清单，让模型改了重交。
- 数据文件夹（默认 `~/.ielts-review-lab`，可用 `IELTS_LAB_DATA` 改）：`sets/*.json`、`reviews/*.json`、`schedule.json`，纯 JSON，可放进 git。网页版的数据在浏览器里，两边暂不自动互通。
- 错题判出后排进次日复习，之后按 1/3/7/14/30 天（与网页版同一套 `gradeScheduleEntry`）。
