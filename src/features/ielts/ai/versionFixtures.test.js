import { describe, expect, test } from 'vitest'
import { checkTemplateVersionFixtures, TEMPLATE_VERSION_FIXTURES } from './versionFixtures.js'
import { getTemplate, getTemplateVersions, validateSchema } from './templates.js'

describe('offline template version regression', () => {
  test('every registered version accepts its fixture and passes evidence verification', () => {
    expect(checkTemplateVersionFixtures()).toEqual({
      templateId: 'ielts.reading.explain',
      versions: ['1.0.0', '1.1.0', '2.0.0'],
      checked: 3,
    })
  })

  test('the versioned fixtures expose the intended schema difference', () => {
    const versions = getTemplateVersions('ielts.reading.explain')
    const v1 = versions.find(version => version.version === '1.0.0')
    const v2 = versions.find(version => version.version === '1.1.0')
    expect(validateSchema(TEMPLATE_VERSION_FIXTURES['ielts.reading.explain']['1.0.0'], v1.outputSchema)).toEqual([])
    expect(validateSchema(TEMPLATE_VERSION_FIXTURES['ielts.reading.explain']['1.0.0'], v2.outputSchema).some(error => error.includes('causeBasis'))).toBe(true)
    // v2.0.0 adds the learner-perspective fields; a v1.1.0 answer no longer passes
    const v3 = versions.find(version => version.version === '2.0.0')
    expect(validateSchema(TEMPLATE_VERSION_FIXTURES['ielts.reading.explain']['1.1.0'], v3.outputSchema).some(error => error.includes('fromYourView'))).toBe(true)
    expect(validateSchema(TEMPLATE_VERSION_FIXTURES['ielts.reading.explain']['2.0.0'], v3.outputSchema)).toEqual([])
    expect(getTemplate('ielts.reading.explain').version).toBe('2.0.0')
  })
})
