import { expect, test } from 'vitest'
import { SPEAKING_TOPICS, parseTopicImport } from './speakingTopics.js'

test('built-in speaking topics have Part 1/2/3 and Part 3 continues Part 2', () => {
  expect(SPEAKING_TOPICS.length).toBeGreaterThanOrEqual(4)
  for (const topic of SPEAKING_TOPICS) {
    expect(topic.part1.length).toBeGreaterThan(0)
    expect(topic.part2.length).toBeGreaterThan(10)
    expect(topic.part3.length).toBeGreaterThan(0)
  }
})

test('imports plain text and structured JSON topic lists', () => {
  expect(parseTopicImport('A recent purchase\nA useful app')).toHaveLength(2)
  expect(parseTopicImport(JSON.stringify([{ title: 'A local festival', part3: ['Why?'] }]), 'json')[0]).toMatchObject({
    title: 'A local festival', part3: ['Why?'], custom: true,
  })
  expect(() => parseTopicImport('{bad', 'json')).toThrow('JSON')
})
