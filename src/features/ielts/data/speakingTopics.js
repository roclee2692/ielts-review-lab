// Original speaking prompts. Imported seasonal lists are kept local to the
// learner's browser and are never shipped with the application.

export const SPEAKING_TOPICS = Object.freeze([
  {
    id: 'useful-skill',
    title: 'A useful practical skill',
    part1: ['What practical skill would you like to learn?', 'Did anyone teach you skills at home?', 'Is it easier to learn skills online?', 'What skill do you think everyone should have?'],
    part2: 'Describe a practical skill you learned that has been useful to you.',
    cues: ['what the skill was', 'how you learned it', 'how long it took', 'why it has been useful'],
    part3: ['Why do some practical skills disappear?', 'Should schools teach more hands-on skills?', 'How does age affect the ability to learn a skill?', 'Can online tutorials replace a real teacher?', 'What skills will matter most in the future?'],
  },
  {
    id: 'memorable-journey',
    title: 'A memorable journey',
    part1: ['How do you usually travel to new places?', 'Do you prefer planning a trip or deciding on the way?', 'What makes a journey memorable?', 'Do you enjoy travelling alone?'],
    part2: 'Describe a journey that you remember well.',
    cues: ['where you went', 'who was with you', 'what happened during the journey', 'why you still remember it'],
    part3: ['Why do people value travel experiences?', 'Has technology made travel less adventurous?', 'Should tourists be restricted in crowded places?', 'How can transport affect a journey?', 'Will virtual travel replace some real trips?'],
  },
  {
    id: 'helpful-person',
    title: 'A person who helped you',
    part1: ['Who usually helps you when you have a problem?', 'Do people ask for help too easily?', 'How do strangers help each other in your area?', 'Are you comfortable asking for advice?'],
    part2: 'Describe a person who helped you with something important.',
    cues: ['who the person is', 'what the problem was', 'how they helped', 'how you felt afterwards'],
    part3: ['Why do some people find it hard to accept help?', 'Should schools teach students to ask for help?', 'How has social media changed the way people support each other?', 'Is volunteering useful for the community or the volunteer?', 'Does a helpful action need to be large to matter?'],
  },
  {
    id: 'changing-place',
    title: 'A place that has changed',
    part1: ['Do you like the area where you live?', 'What changes have happened nearby?', 'Are old buildings important?', 'How often do you revisit familiar places?'],
    part2: 'Describe a place you know that has changed significantly.',
    cues: ['where it is', 'what it was like before', 'what changed', 'how you feel about the change'],
    part3: ['Why do some neighbourhoods change quickly?', 'What is lost when a place becomes more modern?', 'Should residents influence urban development?', 'How can cities preserve local character?', 'Do changes to public spaces affect community life?'],
  },
  {
    id: 'good-habit',
    title: 'A habit you want to build',
    part1: ['What habits are common in your culture?', 'Do you have a habit that helps you study?', 'Is it difficult to break a bad habit?', 'Do routines make life boring?'],
    part2: 'Describe a habit you would like to build and why.',
    cues: ['what the habit is', 'when you noticed it mattered', 'what makes it difficult', 'how you plan to keep it'],
    part3: ['Why are habits important?', 'Should employers encourage healthy habits?', 'How do social groups influence habits?', 'Is discipline more important than motivation?', 'Can small habits lead to major change?'],
  },
])

/** @param {string} text @param {'text'|'json'} format @returns {object[]} */
export function parseTopicImport(text, format = 'text') {
  const raw = String(text || '').trim()
  if (!raw) return []
  if (format === 'json') {
    let parsed
    try { parsed = JSON.parse(raw) } catch { throw new Error('JSON 格式不正确') }
    const list = Array.isArray(parsed) ? parsed : parsed.topics
    if (!Array.isArray(list)) throw new Error('JSON 需要是数组，或包含 topics 数组')
    return list.map((item, index) => normalizeTopic(item, index)).filter(Boolean)
  }
  return raw.split(/\n+/).map(line => line.trim()).filter(Boolean).map((title, index) => normalizeTopic({ title }, index)).filter(Boolean)
}
function normalizeTopic(item, index) {
  if (typeof item === 'string') item = { title: item }
  if (!item || typeof item !== 'object' || !item.title) return null
  const title = String(item.title).trim()
  return {
    id: String(item.id || `custom-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`),
    title,
    part1: Array.isArray(item.part1) ? item.part1.map(String) : [],
    part2: String(item.part2 || `Describe something connected to ${title}.`),
    cues: Array.isArray(item.cues) ? item.cues.map(String) : [],
    part3: Array.isArray(item.part3) ? item.part3.map(String) : [],
    custom: true,
  }
}
