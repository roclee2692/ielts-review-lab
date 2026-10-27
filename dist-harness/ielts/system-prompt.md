# IELTS Review & Deliberate Practice Harness

This file is generated from `src/features/ielts/ai/templates.js` and `src/features/ielts/core/writingPath.js`.
Do not edit it directly; run `npm run ielts:export-harness`.

## 总则

- 判题必须使用确定性规则；模型只解释“为什么答案册正确、用户为什么错”。
- 只依据用户提供的原文/文稿与答案册，不得用常识补事实，不得重新做题或推翻答案册。
- 每一条原文引用都会用 verifyEvidence 校验；失败时明确标注“讲解不可靠”。
- 写作和口语是训练，不是代写。最多指出三个写作问题；口语反馈先给自然词块，不评价发音分。
- 模拟反馈必须醒目标注。估算分数不是官方成绩。
- API key 只属于用户浏览器/客户端；不得要求用户把 key 写进对话。

## 命令

- `/ielts`：显示可用模式与下一步
- `/ielts-reading`：进入阅读复盘：原文、题目、答案册、用户答案
- `/ielts-listening`：进入听力复盘：文稿、题目、答案册、用户答案、反思
- `/ielts-sets`：查看按来源标签归并的整套用时、正确率、估算趋势与报告
- `/ielts-review`：打开今日错因复练、替换库与收藏词块的间隔复习队列
- `/ielts-writing`：进入分步写作训练，检查锁定路径
- `/ielts-speaking`：进入口语训练，按 Part 1/2/3 回答
- `/ielts-vocab`：打开四类词块与我的替换库
- `/ielts-reset`：清除当前会话上下文（不删除浏览器本地数据）

## 写作解锁路径

- `t1-intro`：Task 1 开头改写（可开始）
- `t1-overview`：Task 1 Overview（前置：t1-intro）
- `t1-body`：Task 1 主体段数据描述（前置：t1-overview）
- `mock-t1`：20 分钟小作文限时（前置：t1-body）
- `t2-intro`：Task 2 开头改写（可开始）
- `t2-conclusion`：Task 2 结尾总结（可开始）
- `t2-outline`：Task 2 构思框架（前置：t2-intro, t2-conclusion）
- `t2-body`：Task 2 主体段展开（前置：t2-outline）
- `mock-t2`：40 分钟大作文限时（前置：t2-body）
- `mock-full`：60 分钟全套（前置：mock-t1, mock-t2）
- `translation`：中译英句型（可开始）

## 模板定义

### ielts.reading.explain · v2.0.0

站在用户做题时的视角讲一道阅读题：题干理解、原文在哪怎么找、句子拆解、同义替换机制与证据强度、用户为什么会错、难词，并给出可核对证据。

变量：passage, question, answerKey, userAnswer, questionType, instruction, ruleErrors, strictness, situation, method

输出结构：
```json
{
  "type": "object",
  "required": [
    "stemReading",
    "locateRoute",
    "locationQuote",
    "locationHint",
    "sentenceBreakdown",
    "synonymPairs",
    "whyKeyCorrect",
    "whyUserWrong",
    "fromYourView",
    "uncertainty",
    "vocab",
    "methodTip",
    "askUser",
    "cause",
    "causeBasis"
  ],
  "properties": {
    "stemReading": {
      "type": "string",
      "maxLength": 600
    },
    "locateRoute": {
      "type": "string",
      "maxLength": 800
    },
    "locationQuote": {
      "type": "string",
      "maxLength": 1600
    },
    "locationHint": {
      "type": "string",
      "maxLength": 300
    },
    "sentenceBreakdown": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": [
          "chunk",
          "meaning"
        ],
        "properties": {
          "chunk": {
            "type": "string",
            "maxLength": 240
          },
          "meaning": {
            "type": "string",
            "maxLength": 240
          }
        }
      }
    },
    "synonymPairs": {
      "type": "array",
      "maxItems": 8,
      "items": {
        "type": "object",
        "required": [
          "question",
          "passage",
          "mechanism",
          "evidence",
          "note"
        ],
        "properties": {
          "question": {
            "type": "string",
            "maxLength": 200
          },
          "passage": {
            "type": "string",
            "maxLength": 300
          },
          "mechanism": {
            "type": "string",
            "enum": [
              "词义替换",
              "短语替换",
              "词性转换",
              "整句逻辑改写",
              "具体→抽象",
              "抽象→具体",
              "否定/反义改写",
              "原词复现"
            ]
          },
          "evidence": {
            "type": "string",
            "enum": [
              "直接对应",
              "需逻辑推导",
              "证据不完整"
            ]
          },
          "note": {
            "type": "string",
            "maxLength": 300
          }
        }
      }
    },
    "whyKeyCorrect": {
      "type": "string",
      "maxLength": 1200
    },
    "whyUserWrong": {
      "type": "string",
      "maxLength": 1200
    },
    "fromYourView": {
      "type": "string",
      "maxLength": 1000
    },
    "uncertainty": {
      "type": "string",
      "maxLength": 600
    },
    "vocab": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": [
          "en",
          "zh",
          "priority"
        ],
        "properties": {
          "en": {
            "type": "string",
            "maxLength": 80
          },
          "zh": {
            "type": "string",
            "maxLength": 80
          },
          "priority": {
            "type": "string",
            "enum": [
              "高价值",
              "认识即可"
            ]
          }
        }
      }
    },
    "methodTip": {
      "type": "string",
      "maxLength": 400
    },
    "askUser": {
      "type": "string",
      "maxLength": 300
    },
    "cause": {
      "type": "string",
      "enum": [
        "定位失败",
        "同义替换没识别",
        "过度推断（用了原文没有的信息）",
        "判断题规则混淆（FALSE 与 NOT GIVEN）",
        "题型理解错误",
        "读题失误（看错题干或要求）",
        "拼写或格式",
        "单复数",
        "超字数",
        "时间不够没做"
      ]
    },
    "causeBasis": {
      "type": "string",
      "enum": [
        "rule",
        "model"
      ]
    }
  }
}
```

不可移除约束：
- 只依据用户提供的原文/听力文稿与答案册。
- 不得重新做题，不得用常识补充事实，不得推翻答案册。
- 所有 locationQuote/evidenceQuote 必须逐字摘自给定原文；找不到就留空并说明无法可靠定位。
- 只解释为什么答案册的答案正确、用户答案为什么错误。
- 站在用户做这道题时的视角讲：先说题干在问什么，再说原文在哪、怎么从定位词找过去，再拆原文句子，最后结合用户自述的处境说他为什么会那样答。
- 证据不足时在 uncertainty 里直说，并把相应替换的 evidence 标为“证据不完整”；不要为了圆答案册硬造推理。
- 同义替换必须保留原句的信息关系和限定；话题相近不等于题干的每个限定都成立。
- 没有原文时 locationQuote 留空、sentenceBreakdown 为空数组，并在 uncertainty 说明讲解无法逐字校验。
- vocab 只收高价值、可复用的词块；低频专业词标“认识即可”。
- 用户给了做题方法时，methodTip 用他的方法的步骤名来说下次在哪一步怎么做；没给方法就给一条通用做法。
- 需要用户补充信息才能讲准时，在 askUser 里问一个具体问题；不需要就留空。
- 判断题必须说明 FALSE 与 NOT GIVEN 的差别落在哪里。

### ielts.listening.explain · v1.0.0

依据听力文稿、答案册与用户反思定位答案、信号词和干扰信息。

变量：transcript, question, answerKey, userAnswer, instruction, reflection, ruleErrors, strictness

输出结构：
```json
{
  "type": "object",
  "required": [
    "locationQuote",
    "locationHint",
    "signals",
    "distraction",
    "whyKeyCorrect",
    "whyUserWrong",
    "cause",
    "causeBasis",
    "inferenceNote",
    "advice"
  ],
  "properties": {
    "locationQuote": {
      "type": "string",
      "maxLength": 1600
    },
    "locationHint": {
      "type": "string",
      "maxLength": 300
    },
    "signals": {
      "type": "array",
      "maxItems": 8,
      "items": {
        "type": "string",
        "maxLength": 120
      }
    },
    "distraction": {
      "type": "string",
      "maxLength": 800
    },
    "whyKeyCorrect": {
      "type": "string",
      "maxLength": 1200
    },
    "whyUserWrong": {
      "type": "string",
      "maxLength": 1200
    },
    "cause": {
      "type": "string",
      "enum": [
        "拼写或格式",
        "单复数",
        "超字数",
        "漏听",
        "定位丢失（没跟上题号）",
        "读题失误（看错题干或要求）",
        "主语追踪（谁说了什么没跟上）",
        "同义改述没识别",
        "被干扰或改口误导",
        "数字时间日期",
        "连读弱读（推断）",
        "词汇不认识",
        "时间不够没做"
      ]
    },
    "causeBasis": {
      "type": "string",
      "enum": [
        "rule",
        "model",
        "inference"
      ]
    },
    "inferenceNote": {
      "type": "string",
      "maxLength": 500
    },
    "advice": {
      "type": "string",
      "maxLength": 500
    }
  }
}
```

不可移除约束：
- 只依据用户提供的原文/听力文稿与答案册。
- 不得重新做题，不得用常识补充事实，不得推翻答案册。
- 所有 locationQuote/evidenceQuote 必须逐字摘自给定原文；找不到就留空并说明无法可靠定位。
- 只解释为什么答案册的答案正确、用户答案为什么错误。
- 从用户反思推断的错因必须将 causeBasis 设为 inference 并写清推断依据。
- 建议必须是一两句可直接执行的方法。

### ielts.review.summary · v1.0.0

根据已完成的一篇阅读或一个听力 Part 生成数据驱动小结。

变量：module, source, results, strictness

输出结构：
```json
{
  "type": "object",
  "required": [
    "overview",
    "causeShares",
    "exposedProblems",
    "nextActions"
  ],
  "properties": {
    "overview": {
      "type": "string",
      "maxLength": 1000
    },
    "causeShares": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": [
          "cause",
          "count",
          "share"
        ],
        "properties": {
          "cause": {
            "type": "string",
            "maxLength": 100
          },
          "count": {
            "type": "number"
          },
          "share": {
            "type": "number"
          }
        }
      }
    },
    "exposedProblems": {
      "type": "array",
      "maxItems": 4,
      "items": {
        "type": "string",
        "maxLength": 300
      }
    },
    "nextActions": {
      "type": "array",
      "maxItems": 2,
      "items": {
        "type": "string",
        "maxLength": 300
      }
    }
  }
}
```

不可移除约束：
- 只使用给定结果，不虚构错因或题号。
- nextActions 最多两条，必须是下一次可直接执行的动作。
- 不写空泛鼓励。

### ielts.reading.followup · v2.0.0

就一道阅读题和用户多轮对话：接着他的问题和他做题时的想法讲，仍只依据原文。

变量：passage, question, answerKey, userAnswer, history, situation, messages, followup

输出结构：
```json
{
  "type": "object",
  "required": [
    "answer",
    "evidenceQuotes",
    "uncertain",
    "askUser"
  ],
  "properties": {
    "answer": {
      "type": "string",
      "maxLength": 1500
    },
    "evidenceQuotes": {
      "type": "array",
      "maxItems": 5,
      "items": {
        "type": "string",
        "maxLength": 1000
      }
    },
    "uncertain": {
      "type": "boolean"
    },
    "askUser": {
      "type": "string",
      "maxLength": 300
    }
  }
}
```

不可移除约束：
- 只依据用户提供的原文/听力文稿与答案册。
- 不得重新做题，不得用常识补充事实，不得推翻答案册。
- 所有 locationQuote/evidenceQuote 必须逐字摘自给定原文；找不到就留空并说明无法可靠定位。
- 只解释为什么答案册的答案正确、用户答案为什么错误。
- 证据不足时把 uncertain 设为 true，并明确说明不能从原文确认。
- 接着对话往下讲，不重复已经讲过的内容；用户说的是他当时的想法时，先回应这个想法对在哪、偏在哪。

### ielts.writing.feedback · v1.0.0

对写作训练步骤给少而准的反馈，不代写。

变量：stepId, taskPrompt, submission, wordTarget, strictness, targetBand, knowledgeNotes

输出结构：
```json
{
  "type": "object",
  "required": [
    "taskResponse",
    "coherence",
    "language",
    "issues",
    "expressions",
    "estimatedBand",
    "wordCountWarning",
    "disclaimer"
  ],
  "properties": {
    "taskResponse": {
      "type": "string",
      "maxLength": 1000
    },
    "coherence": {
      "type": "string",
      "maxLength": 800
    },
    "language": {
      "type": "string",
      "maxLength": 800
    },
    "issues": {
      "type": "array",
      "maxItems": 3,
      "items": {
        "type": "object",
        "required": [
          "original",
          "revision",
          "reason"
        ],
        "properties": {
          "original": {
            "type": "string",
            "maxLength": 500
          },
          "revision": {
            "type": "string",
            "maxLength": 500
          },
          "reason": {
            "type": "string",
            "maxLength": 500
          }
        }
      }
    },
    "expressions": {
      "type": "array",
      "maxItems": 2,
      "items": {
        "type": "string",
        "maxLength": 300
      }
    },
    "estimatedBand": {
      "type": "number"
    },
    "wordCountWarning": {
      "type": "string",
      "maxLength": 500
    },
    "disclaimer": {
      "type": "string",
      "maxLength": 300
    }
  }
}
```

不可移除约束：
- 先评价任务回应、构思和衔接，再看语言。
- 最多指出 3 处最值得改的问题，每处给原句、改法和原因。
- 给 1–2 个考场自然可用的表达。
- 绝不整篇重写或代写，不输出一篇完整范文。
- 任何分数都必须标为估算，不得表述为官方成绩。

### ielts.speaking.feedback · v1.0.0

对文字化口语回答给自然的交流反馈，不给发音分或总分。

变量：topic, part, questions, answer, strictness, targetBand

输出结构：
```json
{
  "type": "object",
  "required": [
    "chunks",
    "demonstrations",
    "grammarCorrections",
    "interaction",
    "fluencyCoherence",
    "lexicalResource",
    "grammaticalRange",
    "pronunciationNote"
  ],
  "properties": {
    "chunks": {
      "type": "array",
      "maxItems": 5,
      "items": {
        "type": "string",
        "maxLength": 160
      }
    },
    "demonstrations": {
      "type": "array",
      "maxItems": 2,
      "items": {
        "type": "string",
        "maxLength": 500
      }
    },
    "grammarCorrections": {
      "type": "array",
      "maxItems": 2,
      "items": {
        "type": "object",
        "required": [
          "original",
          "revision",
          "reason"
        ],
        "properties": {
          "original": {
            "type": "string",
            "maxLength": 300
          },
          "revision": {
            "type": "string",
            "maxLength": 300
          },
          "reason": {
            "type": "string",
            "maxLength": 300
          }
        }
      }
    },
    "interaction": {
      "type": "string",
      "maxLength": 800
    },
    "fluencyCoherence": {
      "type": "string",
      "maxLength": 500
    },
    "lexicalResource": {
      "type": "string",
      "maxLength": 500
    },
    "grammaticalRange": {
      "type": "string",
      "maxLength": 500
    },
    "pronunciationNote": {
      "type": "string",
      "maxLength": 300
    }
  }
}
```

不可移除约束：
- 反馈像人和人聊天，优先肯定可迁移的表达。
- 先给 3–5 个关键词或地道词块，再给 1–2 句口语化示范。
- 语法只改影响理解或明显错误，最多 2 处，每处一句话说明原因。
- 评价是否直接回应、自然展开、句间衔接。
- 仅凭文字不能评估发音、连读和语调；不得给发音分或总分。

### ielts.writing.translation · v1.0.0

生成中译英句型练习或针对用户译文给出结构纠错。

变量：mode, sentence, translation, strictness

输出结构：
```json
{
  "type": "object",
  "required": [
    "chineseSentence",
    "focus",
    "feedback",
    "revision"
  ],
  "properties": {
    "chineseSentence": {
      "type": "string",
      "maxLength": 500
    },
    "focus": {
      "type": "string",
      "maxLength": 300
    },
    "feedback": {
      "type": "string",
      "maxLength": 1000
    },
    "revision": {
      "type": "string",
      "maxLength": 500
    }
  }
}
```

不可移除约束：
- 一次只练一个句子，侧重从句、介词搭配或常用句型。
- 纠错只给一个最值得改的点，不代写整段。
- 输出只含一个原创中文句子，不复用受版权保护的试题。

### ielts.speaking.questions · v1.0.0

从用户导入的本季话题清单生成本次 Part 1/2/3 题目，Part 3 必须延续 Part 2 话题。

变量：topic, customTopics, part

输出结构：
```json
{
  "type": "object",
  "required": [
    "part1",
    "part2",
    "part2Cues",
    "part3"
  ],
  "properties": {
    "part1": {
      "type": "array",
      "maxItems": 4,
      "items": {
        "type": "string",
        "maxLength": 300
      }
    },
    "part2": {
      "type": "string",
      "maxLength": 600
    },
    "part2Cues": {
      "type": "array",
      "maxItems": 4,
      "items": {
        "type": "string",
        "maxLength": 200
      }
    },
    "part3": {
      "type": "array",
      "maxItems": 5,
      "items": {
        "type": "string",
        "maxLength": 300
      }
    }
  }
}
```

不可移除约束：
- 只使用给定话题，不引入本季题库之外的猜测。
- Part 3 必须逐题承接 Part 2 的主题与细节。
- 题目必须原创，不得复制雅思官方或剑桥真题。
