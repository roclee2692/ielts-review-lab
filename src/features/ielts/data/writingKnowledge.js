// Original writing knowledge base. It is editable in the UI and can be
// supplemented by learner-imported Markdown/JSON notes.

export const WRITING_KNOWLEDGE = Object.freeze([
  {
    id: 't1-dynamic',
    title: '动态图：线图 / 随时间变化的柱图',
    task: 'task1',
    cards: [
      {
        id: 't1-dynamic-intro', section: '开头改写', title: '动态图开头：改词不改事实',
        content: '保留时间、对象、单位和测量维度，替换题目中的动词与名词。不要加入数据结论，也不要写 “I can see”。一句话完成：图 / 表 + 动词 + 对象 + 时间范围。',
        examples: ['The line graph compares the percentage of commuters using four transport modes from 2000 to 2020.'],
      },
      {
        id: 't1-dynamic-overview', section: 'Overview 写法', title: '动态图 overview：先找最大变化',
        content: '找两到三个最显著特征：整体上升/下降、谁超过谁、差距扩大或缩小。只概括，不逐点列数字。常用 “Overall”“The most noticeable change is…”。',
        examples: ['Overall, cycling gained popularity, while car use declined and eventually fell below rail travel.'],
      },
      {
        id: 't1-dynamic-body', section: '主体段分组', title: '主体段：按方向或高低分组',
        content: '按共同趋势分组，而不是按年份流水账。每组给关键起点、终点、峰值或交叉点；比较变化幅度时使用 by，比较终点水平时使用 at。','examples': ['Rail travel climbed from 12% to 28%, overtaking cars by the end of the period.'],
      },
      {
        id: 't1-dynamic-lexis', section: '常用表达', title: '趋势与速度',
        content: '变化动词后可接 from…to…、by…；水平停顿时用 remain stable at。避免 every year rose sharply 这类机械重复，交替使用名词化表达。',
        examples: ['rise steadily', 'a modest decline', 'peak at 40%', 'level off at around one fifth'],
      },
    ],
  },
  {
    id: 't1-static',
    title: '静态比较图：饼图 / 表格 / 静态柱图',
    task: 'task1',
    cards: [
      {
        id: 't1-static-intro', section: '开头改写', title: '静态图开头：写清比较维度',
        content: '说明图表比较的是哪几组对象、哪个指标、在什么时间或地点。没有时间变化就不要写 over the period。',
        examples: ['The table compares four age groups in terms of monthly leisure spending in one country.'],
      },
      {
        id: 't1-static-overview', section: 'Overview 写法', title: '静态图 overview：抓最大、最小与排名',
        content: '概括最大占比、最明显差距或异常项。两句话以内；具体数值留给主体段。',
        examples: ['Overall, housing was the largest expense for every group, while transport showed the widest variation.'],
      },
      {
        id: 't1-static-body', section: '主体段分组', title: '主体段：先主后次，按类别合并',
        content: '可先写最大/最重要类别，再合并相似类别；同一句最多比较两项，避免把表格所有数字塞进一句。',
        examples: ['Food accounted for 30% of spending among younger respondents, roughly double the figure for the oldest group.'],
      },
      {
        id: 't1-static-lexis', section: '常用表达', title: '比较、占比与差额',
        content: 'account for 后接占比；X was twice/three times Y；the gap between A and B；A had the highest proportion of…。比例和数量不要混用。',
        examples: ['make up one third of', 'be twice as high as', 'a ten-percentage-point gap', 'the second-largest category'],
      },
    ],
  },
  {
    id: 't1-process',
    title: '流程图',
    task: 'task1',
    cards: [
      {
        id: 't1-process-intro', section: '开头改写', title: '流程图开头：点明产物与阶段',
        content: '用主动/被动都可以，但保持一致。开头说明这个流程生产什么、经历了几个主要阶段；不需要解释原因。',
        examples: ['The diagram illustrates how recycled glass is cleaned, melted and turned into new containers.'],
      },
      {
        id: 't1-process-overview', section: 'Overview 写法', title: '流程图 overview：首尾与循环',
        content: '概括起点、终点、主要阶段数量，以及是否循环或产生副产物。',
        examples: ['Overall, the process has four main stages, beginning with collection and ending with packaging.'],
      },
      {
        id: 't1-process-body', section: '主体段分组', title: '主体段：按阶段推进',
        content: '按时间顺序分两段，使用 First、Next、Once…、After being…、Finally。每句只推进一个阶段，明确输入和输出。',
        examples: ['After being sorted, the glass is crushed into small pieces and then washed to remove labels.'],
      },
      {
        id: 't1-process-lexis', section: '常用表达', title: '被动、顺序与目的',
        content: '流程图高频使用一般现在时被动语态。连接词要体现真实先后，不要每句都写 then。',
        examples: ['is transported to', 'is subjected to', 'prior to being heated', 'the resulting material'],
      },
    ],
  },
  {
    id: 't1-map',
    title: '地图',
    task: 'task1',
    cards: [
      {
        id: 't1-map-intro', section: '开头改写', title: '地图开头：地点与年份',
        content: '说明两幅地图展示同一地点的哪些年份，以及主要功能（校园、城镇中心、公园）。不要把变化提前写进开头。',
        examples: ['The maps show how a coastal village changed between 1995 and 2025.'],
      },
      {
        id: 't1-map-overview', section: 'Overview 写法', title: '地图 overview：总体变化方向',
        content: '找最显著的空间变化：住宅区扩大、绿地减少、道路新增、某功能被迁移。用 in the north/south/east/west 定位。',
        examples: ['Overall, the village became more residential, and the farmland in the east was replaced by housing.'],
      },
      {
        id: 't1-map-body', section: '主体段分组', title: '主体段：按方位或变化类型',
        content: '先建立一个可追踪的方位框架，再按区域描述。使用被动语态说明改造，使用 remain unchanged 说明未变部分。',
        examples: ['The shop on the north side was converted into a café, while the adjoining car park was extended.'],
      },
      {
        id: 't1-map-lexis', section: '常用表达', title: '方位与变化',
        content: '区分 to the north of（外部）与 in the north of（内部）；说明替代关系时用 be replaced by。',
        examples: ['be demolished', 'be converted into', 'be extended southwards', 'on the opposite side of the road'],
      },
    ],
  },
  {
    id: 't2-intro-conclusion',
    title: 'Task 2：开头与结尾',
    task: 'task2',
    cards: [
      {
        id: 't2-intro', section: '开头改写', title: '两句话完成开头',
        content: '第一句改写背景，不照抄题目；第二句直接给立场或回答题目。开头不要展开论据，也不要写 “This essay will discuss both sides and give my opinion”。',
        examples: ['Many cities now charge drivers to enter busy centres. In my view, the policy is justified if the revenue improves public transport.'],
      },
      {
        id: 't2-conclusion', section: '结尾总结', title: '结尾只收束，不添加新论点',
        content: '用一句话重述立场，再用一句话概括主要理由。换一种说法，但不能引入前文没出现的信息。',
        examples: ['In conclusion, congestion charging can be effective, provided that the money is visibly reinvested in affordable alternatives.'],
      },
    ],
  },
  {
    id: 't2-argument',
    title: 'Task 2：立场与论证',
    task: 'task2',
    cards: [
      {
        id: 't2-stance', section: '立场表达', title: '立场要可判断',
        content: '立场不是 “both are important” 这种安全话，而是明确回答题目要求。可以部分同意，但要写清在什么条件下同意。',
        examples: ['While I accept that regulation has costs, I believe it is necessary where public safety is at risk.'],
      },
      {
        id: 't2-outline', section: '构思框架', title: '每个分论点都要有论证动作',
        content: '主体段结构：中心句 → 解释机制 → 例子/因果/对比 → 回扣题目。列提纲时直接写出“用什么方式证明”，避免只写关键词。',
        examples: ['Point: flexible hours reduce commuting pressure. Evidence: staggered arrival times cut peak demand. Link: this benefits both workers and transport systems.'],
      },
      {
        id: 't2-body', section: '主体段展开', title: '一段只解决一个中心问题',
        content: '中心句先给判断，再解释 why/how，例子只支持这一点。对比和让步放在段末，不要中途换题。',
        examples: ['A second benefit concerns access. When appointments are available online, people without a car can use services without losing a day of work.'],
      },
      {
        id: 't2-concession', section: '让步与转折', title: '先承认有效担忧，再限定范围',
        content: '让步不是削弱立场，而是显示论证边界。常用 While、Admittedly、It is true that；转折后必须回应担忧。',
        examples: ['Admittedly, online services can exclude older users. This risk can be reduced, however, by keeping telephone support available.'],
      },
    ],
  },
  {
    id: 'general-language',
    title: '通用：连接、搭配与高频词块',
    task: 'general',
    cards: [
      {
        id: 'general-linking', section: '逻辑连接', title: '连接词服务于关系，不是装饰',
        content: '因果、对比、递进、举例各司其职。段内不要连续使用 Furthermore；简单句之间可以用 this、such、in turn 建立指代关系。',
        examples: ['As a result, demand fell.', 'By contrast, rural numbers rose.', 'This, in turn, reduced waiting times.'],
      },
      {
        id: 'general-prepositions', section: '介词搭配', title: '高频介词搭配',
        content: '注意动词/名词固定搭配，不要只背中文义。写完后单独检查介词和冠词。',
        examples: ['an increase in demand', 'invest in public transport', 'access to education', 'a solution to the problem', 'responsible for change'],
      },
      {
        id: 'general-chunks', section: '高频词块', title: '可直接调用的写作词块',
        content: '词块要嵌入自己的句子。不要整段套模板；相同词块在不同题目中需要替换对象和限定条件。',
        examples: ['play a central role in', 'place pressure on', 'offer a practical alternative to', 'be shaped by both A and B', 'the extent to which'],
      },
      {
        id: 'general-translation', section: '中译英句型', title: '从句与常用句型',
        content: '练习时先判断主干，再添加从句。重点观察 that/which/whether 从句、强调句和比较结构，而不是逐字翻译。',
        examples: ['It is the feedback, rather than the score, that helps learners improve.', 'The question is whether the benefits justify the cost.'],
      },
    ],
  },
])

export const KNOWLEDGE_FOR_STEP = Object.freeze({
  't1-intro': ['t1-dynamic-intro', 't1-static-intro', 't1-process-intro', 't1-map-intro'],
  't1-overview': ['t1-dynamic-overview', 't1-static-overview', 't1-process-overview', 't1-map-overview'],
  't1-body': ['t1-dynamic-body', 't1-static-body', 't1-process-body', 't1-map-body'],
  'mock-t1': ['t1-dynamic-lexis', 't1-static-lexis', 't1-process-lexis', 't1-map-lexis'],
  't2-intro': ['t2-intro'],
  't2-conclusion': ['t2-conclusion'],
  't2-outline': ['t2-outline', 't2-stance'],
  't2-body': ['t2-body', 't2-concession'],
  'mock-t2': ['t2-stance', 't2-body', 't2-concession'],
  'mock-full': ['general-linking', 'general-prepositions', 'general-chunks'],
  translation: ['general-translation', 'general-chunks'],
})

export const KNOWLEDGE_CARDS = Object.freeze(WRITING_KNOWLEDGE.flatMap(group => group.cards))

export function getKnowledgeCard(id) {
  return KNOWLEDGE_CARDS.find(card => card.id === id) || null
}
