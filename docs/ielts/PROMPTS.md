# IELTS 模型模板

单一事实源：`src/features/ielts/ai/templates.js`。模板 id 只能在服务端中转白名单中注册一次；客户端每次调用都通过 `invokeTemplate`。输出先按 JSON Schema 形状校验，不合格重试一次，再失败返回 `INVALID_OUTPUT`。

## 公共约束

- 阅读/听力只依据用户提供的原文、文稿与答案册；不得重新做题或推翻答案册。
- 引用必须逐字来自材料；客户端再用 `verifyEvidence` 校验。
- 写作不整篇重写；口语不虚构发音评价。
- 模拟反馈由 `ai/mock.js` 生成，`meta.mock=true`，界面不得显示成真实模型讲解。
- 请求前由 `ModelSendDialog` 展示模板、服务商、模型、字符数和完整消息。

## 模板清单

### `ielts.reading.explain` · 2.0.0

- 用途：站在用户做题时的视角讲一道阅读题。
- 变量：`passage`（可为空）、`question`、`answerKey`、`userAnswer`、`questionType`、`instruction`、`ruleErrors`、`strictness`、`situation`（用户点的处境标签 + 自述）、`method`（当前做题方法的简述）。
- 输出：`stemReading`（题干在问什么）、`locateRoute`（原文在哪、怎么找过去）、`locationQuote`、`locationHint`、`sentenceBreakdown[]`（词块 + 中文）、`synonymPairs[]`（`question`、`passage`、`mechanism`、`evidence`、`note`）、`whyKeyCorrect`、`whyUserWrong`、`fromYourView`（结合处境：你为什么会那样答）、`uncertainty`、`vocab[]`（`en`、`zh`、`priority`）、`methodTip`、`askUser`、`cause`、`causeBasis`。
- 关键约束：
  - 先题干、再定位路径、再拆句、最后从用户处境解释；
  - 证据不足写进 `uncertainty`，相应替换标“证据不完整”，不许为了圆答案册硬造推理；
  - 同义替换必须保留原句的信息关系和限定，话题相近不等于每个限定都成立；
  - 没有原文时 `locationQuote` 留空、`sentenceBreakdown` 为空，并说明无法校验；
  - `methodTip` 用用户方法里的步骤名说下次怎么做；
  - 判断题讲清 FALSE 与 NOT GIVEN 的界限。
- 替换机制（固定词表）：词义替换、短语替换、词性转换、整句逻辑改写、具体→抽象、抽象→具体、否定/反义改写、原词复现。证据强度：直接对应、需逻辑推导、证据不完整。
- 版本历史：`1.0.0` 不要求 `causeBasis`；`1.1.0` 区分规则判定与模型建议；`2.0.0` 加入用户视角、机制与证据强度、难词和多轮追问用的 `askUser`。三版的固定样例都由离线版本检查脚本验证。

### `ielts.listening.explain` · 1.0.0

- 用途：按文稿定位答案、信号词、改口/干扰，并结合反思建议错因。
- 变量：`transcript`、`question`、`answerKey`、`userAnswer`、`instruction`、`reflection`、`ruleErrors`、`strictness`。
- 输出：`locationQuote`、`locationHint`、`signals[]`、`distraction`、`whyKeyCorrect`、`whyUserWrong`、`cause`、`causeBasis`、`inferenceNote`、`advice`。
- 关键约束：从反思推断的错因必须标 `inference`；建议必须可执行。

### `ielts.review.summary` · 1.0.0

- 用途：一篇阅读或一个听力 Part 的数据驱动小结。
- 变量：`module`、`source`、`results`、`strictness`。
- 输出：`overview`、`causeShares[]`、`exposedProblems[]`、`nextActions[]`（最多 2 条）。
- 关键约束：不得虚构题号或错因；不写空泛鼓励。

### `ielts.reading.followup` · 2.0.0

- 用途：就一道阅读题和用户多轮对话。
- 变量：`passage`、`question`、`answerKey`、`userAnswer`、`history`（已有讲解）、`situation`、`messages[]`（之前的对话，最多带最近 8 轮）、`followup`。
- 输出：`answer`、`evidenceQuotes[]`、`uncertain`、`askUser`。
- 关键约束：证据不足必须 `uncertain=true`；接着对话往下讲，不重复；用户说的是当时的想法时，先回应这个想法对在哪、偏在哪。
- 版本历史：`1.0.0` 是单轮追问。

### `ielts.writing.feedback` · 1.0.0

- 用途：写作路径每个节点的反馈。
- 变量：`stepId`、`taskPrompt`、`submission`、`wordTarget`、`strictness`、`targetBand`、`knowledgeNotes`。
- 输出：`taskResponse`、`coherence`、`language`、`issues[]`（最多 3）、`expressions[]`（1–2）、`estimatedBand`、`wordCountWarning`、`disclaimer`。
- 关键约束：先任务回应和构思，再语言；给原句、改法、原因；不整篇重写；`t2-outline` 只检查逻辑与切题，不改语言。

### `ielts.speaking.feedback` · 1.0.0

- 用途：文字化口语回答的自然交流反馈。
- 变量：`topic`、`part`、`questions`、`answer`、`strictness`、`targetBand`。
- 输出：`chunks[]`、`demonstrations[]`、`grammarCorrections[]`（最多 2）、`interaction`、`fluencyCoherence`、`lexicalResource`、`grammaticalRange`、`pronunciationNote`。
- 关键约束：3–5 个词块、1–2 句口语示范；发音/连读/语调只能说明“仅凭文字无法评估”。

### `ielts.writing.translation` · 1.0.0

- 用途：生成中译英句型题或给译文一个最小改动。
- 变量：`mode`、`sentence`、`translation`、`strictness`。
- 输出：`chineseSentence`、`focus`、`feedback`、`revision`。
- 关键约束：一次一句，侧重从句、介词搭配或常用句型。

### `ielts.speaking.questions` · 1.0.0

- 用途：从内置或用户导入的本季话题生成 Part 1/2/3。
- 变量：`topic`、`customTopics`、`part`。
- 输出：`part1[]`、`part2`、`part2Cues[]`、`part3[]`。
- 关键约束：Part 3 必须承接 Part 2；题目原创，不复制官方题库。

## 失败状态

- `NO_KEY`：没有配置 key；判题、错题、归因、词块和计时继续可用。
- `PROVIDER`：服务商 HTTP 错误。
- `TIMEOUT`：45 秒客户端超时；中转函数 30 秒超时。
- `INVALID_OUTPUT`：连续两次 JSON/结构校验失败。
- `NETWORK`：浏览器无法连接服务商。

模拟反馈不是以上错误状态：它由用户主动选择，并全程标记 `模拟反馈（未调用模型）`。
