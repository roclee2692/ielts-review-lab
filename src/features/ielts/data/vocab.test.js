import { describe, expect, test } from 'vitest'
import { ALL_VOCAB, VOCAB_CATEGORIES, searchVocab } from './vocab.js'

describe('vocabulary content', () => {
  test('contains four categories with at least twenty original entries each', () => {
    expect(VOCAB_CATEGORIES).toHaveLength(4)
    for (const category of VOCAB_CATEGORIES) {
      expect(category.items.length).toBeGreaterThanOrEqual(20)
    }
  })

  test('every entry has a Chinese meaning, example and collocation note', () => {
    // Three drafts merged and deduplicated by expression.
    expect(ALL_VOCAB.length).toBeGreaterThanOrEqual(200)
    expect(new Set(ALL_VOCAB.map(item => item.id)).size).toBe(ALL_VOCAB.length)
    for (const item of ALL_VOCAB) {
      expect(item.meaning).toMatch(/[\u3400-\u9fff]/)
      expect(item.example.length).toBeGreaterThan(15)
      expect(item.collocation.length).toBeGreaterThan(3)
    }
  })

  test('searches Chinese, English and collocations', () => {
    expect(searchVocab('上升', 'task1').length).toBeGreaterThan(0)
    expect(searchVocab('overtake')[0].id).toBe('t1-08')
    expect(searchVocab('rather than')[0].categoryId).toBe('listening-signals')
  })
})
