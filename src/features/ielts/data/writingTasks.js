// Original practice prompts and data. Not sourced from Cambridge or IELTS tests.

export const WRITING_TASKS = Object.freeze({
  't1-intro': {
    kind: 'dynamic',
    label: '动态折线图 · 原创数据',
    prompt: 'The line graph below shows the percentage of commuters using four transport modes in a medium-sized city between 2000 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    chart: {
      caption: '原创示例数据，非真题',
      columns: ['Year', 'Car', 'Bus', 'Rail', 'Bicycle'],
      rows: [['2000', '62%', '24%', '8%', '6%'], ['2010', '54%', '25%', '13%', '8%'], ['2020', '41%', '22%', '24%', '13%']],
    },
    instruction: '只写开头改写（1–2 句），不要写 overview 或主体段。',
    wordTarget: 40,
  },
  't1-overview': {
    kind: 'dynamic',
    label: '动态折线图 · 原创数据',
    prompt: 'The line graph below shows the percentage of commuters using four transport modes in a medium-sized city between 2000 and 2020. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    chart: {
      caption: '原创示例数据，非真题',
      columns: ['Year', 'Car', 'Bus', 'Rail', 'Bicycle'],
      rows: [['2000', '62%', '24%', '8%', '6%'], ['2010', '54%', '25%', '13%', '8%'], ['2020', '41%', '22%', '24%', '13%']],
    },
    instruction: '写开头 + overview，不逐项列数据。',
    wordTarget: 70,
  },
  't1-body': {
    kind: 'static',
    label: '静态表格 · 原创数据',
    prompt: 'The table below shows average monthly spending in four categories for households in two towns in 2025.',
    chart: {
      caption: '原创示例数据，非真题',
      columns: ['Category', 'River Town', 'Hill Town'],
      rows: [['Housing', '42%', '31%'], ['Food', '24%', '28%'], ['Transport', '18%', '25%'], ['Leisure', '16%', '16%']],
    },
    instruction: '只写一个主体段，按共同点和差异分组，至少做两次比较。',
    wordTarget: 90,
  },
  'mock-t1': {
    kind: 'process',
    label: '流程图 · 原创文字结构',
    prompt: 'The diagram describes how used cooking oil is turned into a cleaning product. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    diagramText: [
      'Collection: used oil is poured into sealed containers at community points.',
      'Filtering: solid food waste is removed through a mesh filter.',
      'Heating: the filtered oil is heated to 60°C for twenty minutes.',
      'Mixing: an alkaline solution is added and the mixture is stirred.',
      'Cooling and packaging: the product cools for four hours, is tested, and is bottled.',
    ],
    instruction: '20 分钟完成完整 Task 1（至少 150 词）。',
    wordTarget: 150,
    minutes: 20,
  },
  't2-intro': {
    prompt: 'Some people believe that all university students should study a practical subject, while others think subjects with no obvious career link are equally valuable. Discuss both views and give your own opinion.',
    instruction: '只写开头（背景改写 + 明确立场），不展开理由。',
    wordTarget: 60,
  },
  't2-conclusion': {
    prompt: 'Some people believe that all university students should study a practical subject, while others think subjects with no obvious career link are equally valuable. Discuss both views and give your own opinion.',
    instruction: '只写结尾总结，不引入新论点。',
    wordTarget: 55,
  },
  't2-outline': {
    prompt: 'Many cities are considering charging drivers a fee to enter the city centre. Do the advantages of this policy outweigh the disadvantages?',
    instruction: '限时搭框架：立场；开头一句；结尾一句；两个主体段中心论点；每段两个分论点，并写明举例、因果或对比的论证方式。',
    wordTarget: 180,
    minutes: 10,
  },
  't2-body': {
    prompt: 'Many cities are considering charging drivers a fee to enter the city centre. Do the advantages of this policy outweigh the disadvantages?',
    instruction: '只写一个主体段：中心句 → 解释 → 例子/因果 → 回扣题目。',
    wordTarget: 150,
  },
  'mock-t2': {
    prompt: 'Some people think that schools should teach financial management as a compulsory subject. To what extent do you agree or disagree?',
    instruction: '40 分钟完成完整 Task 2（至少 250 词）。',
    wordTarget: 250,
    minutes: 40,
  },
  'mock-full': {
    prompt: '先完成 Task 1（动态图），再完成 Task 2（同意与否）。',
    instruction: '60 分钟连续完成两篇：Task 1 建议 20 分钟，Task 2 建议 40 分钟。提交时用空行分隔 [TASK 1] 与 [TASK 2]。',
    wordTarget: 400,
    minutes: 60,
    combined: true,
  },
  translation: {
    prompt: '把模型给出的中文句子翻译成自然英文。',
    instruction: '先判断主干，再检查从句、介词搭配和时态。',
    wordTarget: 0,
  },
})

export function taskForStep(stepId) {
  return WRITING_TASKS[stepId] || WRITING_TASKS['t1-intro']
}
