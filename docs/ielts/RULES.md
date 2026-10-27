# IELTS 规则与来源

访问日期：2026-10-23。下面的链接只用于规则登记；应用运行不访问这些页面，测试也不联网。

| 来源 | 链接 | 适用范围 |
|---|---|---|
| IELTS · Scoring in detail | https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail | 四项 Band、总分、写作权重 |
| IELTS · How IELTS is scored | https://ielts.org/take-a-test/your-results/how-ielts-is-scored | 0.5 分档、总分取整、评分维度 |
| IELTS · Academic test format | https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-test-format | 阅读题型、听力 Part、写作时限与词数 |
| British Council · Understanding scores | https://takeielts.britishcouncil.org/take-ielts/prepare/understanding-scores | Band 描述与“估算非官方”提示 |
| Cambridge English · IELTS | https://www.cambridgeenglish.org/exams-and-tests/ielts/ | 考试结构交叉核对、版权边界 |

> 自动化访问 `ielts.org` 与 British Council 页面时返回 403；本仓库没有据未取得的页面正文扩展规则。上表记录的是官方公开入口、访问日期和项目适用范围。

## 确定性判题

### 字数要求

支持且大小写不敏感：

- `ONE WORD ONLY`：最多 1 个词，不允许数字。
- `ONE WORD AND/OR A NUMBER`：最多 1 个词、最多 1 个数字，两者可以同时出现。
- `NO MORE THAN TWO WORDS`：最多 2 个词，不允许数字。
- `NO MORE THAN TWO WORDS AND/OR A NUMBER`：最多 2 个词、最多 1 个数字。
- `NO MORE THAN THREE WORDS`：最多 3 个词，不允许数字。
- `NO MORE THAN THREE WORDS AND/OR A NUMBER`：最多 3 个词、最多 1 个数字。
- `A NUMBER`：恰好 1 个数字，不允许词。

词数按空白切分；连字符词算一个词；纯数字 token 单独计数。超出限制直接判错，错误码为 `WORD_LIMIT`。空作答为 `EMPTY`。

### 答案写法

- 大小写不敏感，连续空白与常见弯引号/破折号会归一化。
- `/` 表示可接受写法，例如 `colour/color`。
- 圆括号表示可省略内容，例如 `(the) museum` 接受 `museum` 与 `the museum`。
- `question.key` 可为字符串或字符串数组。
- `mcq-multi` 的答案集合无序比较，支持 `A, C`、`A/C` 或数组。

### 错误码优先级

1. `EMPTY`：没作答。
2. `WRONG_LABEL_SET`：TFNG 题用了 YES/NO，或 YNNG 题用了 TRUE/FALSE。
3. `WORD_LIMIT`：格式已违反字数要求；即使语义匹配也判错。
4. 完全匹配：正确，`errors=[]`。
5. `PLURAL`：只去掉/加上 `s`、`es`，或做 `y`/`ies` 互转后可匹配。
6. `SPELLING`：不属于单复数差异，但编辑距离为 1–2。
7. `MISMATCH`：其他不一致。

判断题仅接受完整标签，大小写不敏感：

- TFNG：`TRUE`、`FALSE`、`NOT GIVEN`。
- YNNG：`YES`、`NO`、`NOT GIVEN`。

`T/F/NG`、`Y/N/NG` 等缩写未在可核实的公开材料中确认，因此本项目**不接受**；这是保守实现，不是对官方评分口径的推断。

`PLURAL` 与 `SPELLING` 是诊断错误，不会被当作正确。它们只覆盖常见词形，不规则复数可能落入 `MISMATCH`。

## 分数换算

`rawToBand(module, raw)` 接受 0–40 的整数，返回 0.5 分档。完整表是按公开 Band 描述与常见公开锚点补全的**项目估算表**，不称为官方完整换算表。官方可能因试卷版本微调换算，真实成绩以考试机构为准。

当前项目估算：

| Raw | Listening | Academic Reading | General Reading |
|---:|---:|---:|---:|
| 39–40 | 9.0 | 9.0 | 8.5–9.0 |
| 37–38 | 8.5 | 8.5 | 8.0–8.5 |
| 35–36 | 8.0 | 8.0 | 7.5–8.0 |
| 32–34 | 7.5–8.0 | 7.5–8.0 | 6.5–7.0 |
| 30–31 | 7.0 | 7.0–7.5 | 6.0–6.5 |
| 26–29 | 6.5–7.0 | 6.5–7.0 | 5.5–6.0 |
| 23–25 | 6.0–6.5 | 6.0 | 5.0–5.5 |
| 19–22 | 5.5–6.0 | 5.5 | 4.5–5.0 |
| 15–18 | 5.0–5.5 | 5.0–5.5 | 4.0–4.5 |
| 10–14 | 4.0–4.5 | 4.0–4.5 | 3.5–4.0 |
| 6–9 | 3.0–3.5 | 3.0–3.5 | 2.5–3.0 |
| 4–5 | 2.5 | 2.5 | 2.0 |
| 2–3 | 2.0 | 2.0 | 1.5 |
| 1 | 1.0 | 1.0 | 1.0 |
| 0 | 0 | 0 | 0 |

阅读估算只在同一套三篇、听力只在同一套四个 Part 均录入且总题数至少 37 时显示；界面明确标注“估算，非官方成绩”。

### 总分、写作、口语

- `overallBand`：四项平均，按官方常见的最近 0.5 档取整（`.25` 向上到半档，`.75` 向上到整档）。
- `writingBand`：两篇四项标准分别等权平均；Task 2 权重是 Task 1 的两倍；最终取最近 0.5 档。中间取整细节列为非官方假设。
- `speakingBand`：四项等权平均并取最近 0.5 档。界面在只有文字、没有发音分时**不调用**它，也不给口语总分。

## 证据校验

所有原文/文稿引用都要经过 `verifyEvidence`：

1. 原文与引用都合并连续空白、忽略大小写。
2. 每个引用必须是原文子串。
3. 任一引用不满足即 `ok=false`，界面显示“讲解不可靠”，允许重试。

不提供模糊匹配，避免把模型臆造的“近似句”当作原文。

## 写作训练路径

- Task 1：`t1-intro → t1-overview → t1-body → mock-t1`。
- Task 2：`t2-intro` 与 `t2-conclusion` 都完成后才开放 `t2-outline → t2-body → mock-t2`。
- `mock-t1` 与 `mock-t2` 都完成后开放 `mock-full`。
- `translation` 随时开放。

每个节点必须在提交后获得真实或醒目标注的模拟反馈才算完成。UI 与 `canStart` 使用同一份路径定义；直接输入 URL 参数也会被拦截。

## 模型约束

- 讲解只依据用户提供的原文/文稿与答案册，不重新做题、不推翻答案册。
- 写作最多指出 3 处问题，不整篇重写；口语最多改 2 处明显语法问题，不评价发音分。
- 反馈严格度只影响措辞和详略，不影响判题。

## 非官方假设

完整原始分换算区间、写作中间取整、口语取整、编辑距离 1–2 的拼写诊断、常见单复数诊断，均属于项目实现策略，不是官方公开评分细节。代码和产品界面不得把它们表述为官方事实。
