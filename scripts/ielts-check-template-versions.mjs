import { checkTemplateVersionFixtures } from '../src/features/ielts/ai/versionFixtures.js'

const result = checkTemplateVersionFixtures()
process.stdout.write(`Template versions verified: ${result.templateId} ${result.versions.join(' -> ')} (${result.checked} fixtures).\n`)
