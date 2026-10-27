import { verifyEvidence } from '../core/index.js'
import { SAMPLE_READING } from '../data/samples.js'
import { getTemplate, getTemplateVersions, validateSchema } from './templates.js'

const QUOTE = 'The cabinet sits beside the reading room and contains drills, ladders and gardening equipment.'

export const TEMPLATE_VERSION_FIXTURES = Object.freeze({
  'ielts.reading.explain': Object.freeze({
    '1.0.0': Object.freeze({
      locationQuote: QUOTE,
      locationHint: 'Paragraph 1, second sentence',
      synonymPairs: [{ question: 'next to', passage: 'beside the reading room' }],
      whyKeyCorrect: 'The answer key follows the quoted sentence.',
      whyUserWrong: 'The user answer conflicts with the quoted sentence.',
      cause: '同义替换没识别',
    }),
    '1.1.0': Object.freeze({
      locationQuote: QUOTE,
      locationHint: 'Paragraph 1, second sentence',
      synonymPairs: [{ question: 'next to', passage: 'beside the reading room' }],
      whyKeyCorrect: 'The answer key follows the quoted sentence.',
      whyUserWrong: 'The user answer conflicts with the quoted sentence.',
      cause: '同义替换没识别',
      causeBasis: 'model',
    }),
  }),
})

/**
 * Offline regression for template evolution. No network, credentials or user data.
 * @returns {{ templateId: string, versions: string[], checked: number }}
 */
export function checkTemplateVersionFixtures() {
  const templateId = 'ielts.reading.explain'
  const versions = getTemplateVersions(templateId)
  if (versions.length < 2) throw new Error(`${templateId} needs at least two registered versions`)
  const current = getTemplate(templateId)
  if (versions.at(-1).version !== current.version) throw new Error('Latest registered version is not current')

  const fixtures = TEMPLATE_VERSION_FIXTURES[templateId]
  let checked = 0
  for (const version of versions) {
    const fixture = fixtures[version.version]
    if (!fixture) throw new Error(`Missing fixture for ${templateId}@${version.version}`)
    const schemaErrors = validateSchema(fixture, version.outputSchema)
    if (schemaErrors.length) throw new Error(`${templateId}@${version.version} schema failed: ${schemaErrors.join('; ')}`)
    const evidence = verifyEvidence(SAMPLE_READING.passage, [
      fixture.locationQuote,
      ...(fixture.synonymPairs || []).map(pair => pair.passage),
    ])
    if (!evidence.ok) throw new Error(`${templateId}@${version.version} evidence failed: ${evidence.missing.join(' | ')}`)
    checked += 1
  }
  return { templateId, versions: versions.map(version => version.version), checked }
}
