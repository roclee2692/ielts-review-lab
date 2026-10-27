// All examples below are original and intentionally short. They are not IELTS
// past papers and must remain labelled as such in the UI and exported material.

export const SAMPLE_READING = Object.freeze({
  title: '原创示例：社区图书馆的共享工具柜',
  source: '原创示例，非真题',
  passage: `The Riverside Library has had a tool cabinet since 2022. The cabinet sits beside the reading room and contains drills, ladders and gardening equipment. Members can borrow one item for two weeks, and the library sends a text message before the due date. The service was designed for people who need a tool once rather than every week. Staff say the most requested item is still the folding ladder. The library does not accept power tools, and all borrowed items must be returned to a staff member rather than left in the after-hours box.`,
  questions: [
    {
      id: 'rq1', number: 1, type: 'tfng', prompt: 'The tool cabinet is in a different building from the reading room.',
      key: 'FALSE', instruction: '',
    },
    {
      id: 'rq2', number: 2, type: 'gap', prompt: 'Members may keep an item for ______.',
      key: 'two weeks', instruction: 'NO MORE THAN TWO WORDS',
      userAnswer: 'two week',
    },
    {
      id: 'rq3', number: 3, type: 'mcq', prompt: 'Which item is requested most often?',
      options: ['A. a drill', 'B. a ladder', 'C. a garden fork', 'D. a power tool'],
      key: 'B', instruction: 'Choose ONE answer', userAnswer: 'A',
    },
    {
      id: 'rq4', number: 4, type: 'ynng', prompt: 'Borrowed items can be left in the after-hours box.',
      key: 'NO', instruction: '', userAnswer: 'NOT GIVEN',
    },
  ],
  userAnswers: { rq1: 'FALSE', rq2: 'two week', rq3: 'A', rq4: 'NOT GIVEN' },
})

export const SAMPLE_LISTENING = Object.freeze({
  title: '原创示例：校园自行车维修站',
  source: '原创示例，非真题',
  transcript: `Good morning. I'm calling about the bicycle repair station that opened near the sports hall. It is free for students, but you need to book a slot online. The station is open from nine until five on weekdays. We had planned to open at eight, but the mechanic now starts an hour later. Bring your student card and your own lock. We cannot store bikes overnight, so please collect yours before five. Oh, and the first repair is limited to fifteen minutes. If your bike needs more work, you will be asked to book a second visit.`,
  questions: [
    { id: 'lq1', number: 1, type: 'gap', prompt: 'The repair station opens at ______ on weekdays.', key: 'nine', instruction: 'ONE WORD AND/OR A NUMBER', userAnswer: 'eight' },
    { id: 'lq2', number: 2, type: 'gap', prompt: 'Students need to book a ______ online.', key: 'slot', instruction: 'ONE WORD ONLY', userAnswer: 'slots' },
    { id: 'lq3', number: 3, type: 'gap', prompt: 'The repair service is free for ______.', key: 'students', instruction: 'ONE WORD ONLY', userAnswer: 'students' },
    { id: 'lq4', number: 4, type: 'gap', prompt: 'The station had originally planned to open at ______.', key: 'eight', instruction: 'ONE WORD AND/OR A NUMBER', userAnswer: 'eight' },
    { id: 'lq5', number: 5, type: 'gap', prompt: 'Students should bring a student card and their own ______.', key: 'lock', instruction: 'ONE WORD ONLY', userAnswer: 'lock' },
    { id: 'lq6', number: 6, type: 'gap', prompt: 'Bikes cannot be stored ______.', key: 'overnight', instruction: 'ONE WORD ONLY', userAnswer: 'overnight' },
    { id: 'lq7', number: 7, type: 'gap', prompt: 'Bikes should be collected before ______.', key: 'five', instruction: 'ONE WORD AND/OR A NUMBER', userAnswer: 'five' },
    { id: 'lq8', number: 8, type: 'gap', prompt: 'The first repair lasts no more than ______ minutes.', key: 'fifteen', instruction: 'ONE WORD AND/OR A NUMBER', userAnswer: 'fifteen' },
    { id: 'lq9', number: 9, type: 'gap', prompt: 'If more work is needed, students must book a ______ visit.', key: 'second', instruction: 'ONE WORD ONLY', userAnswer: 'second' },
    { id: 'lq10', number: 10, type: 'mcq', prompt: 'What must students bring for the repair?', options: ['A. a receipt', 'B. their own lock', 'C. a replacement tyre'], key: 'B', instruction: 'Choose ONE answer', userAnswer: 'C' },
  ],
  reflections: {
    lq1: '我把 planned to open at eight 听成了最终时间，没反应过来后面改口说 mechanic starts an hour later。',
    lq2: '我把 book a slot 里的单数听成了复数，写成了 slots。',
    lq10: '选项 B 和 C 都听到了类似词，我被 tyre 干扰，没注意 lock 才是原文要求带的东西。',
  },
})

export function buildSampleQuestions(module) {
  const sample = module === 'listening' ? SAMPLE_LISTENING : SAMPLE_READING
  return sample.questions.map(question => ({ ...question, options: [...(question.options || [])] }))
}
