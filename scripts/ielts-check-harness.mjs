import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildHarnessExport } from './ielts-export-harness.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const expected = buildHarnessExport()
const checks = [
  ['commands.json', `${JSON.stringify(expected.commands, null, 2)}\n`],
  ['system-prompt.md', expected.systemPrompt],
]

for (const [name, content] of checks) {
  const actual = await readFile(join(ROOT, 'dist-harness/ielts', name), 'utf8')
  if (actual !== content) {
    process.stderr.write(`Harness export is stale: ${name}. Run npm run ielts:export-harness.\n`)
    process.exit(1)
  }
}

const required = ['/ielts-reading', '/ielts-listening', '/ielts-sets', '/ielts-review', '/ielts-writing', '/ielts-speaking', '/ielts-vocab', '/ielts-reset']
const names = new Set(expected.commands.commands.map(command => command.name))
for (const command of required) {
  if (!names.has(command)) {
    process.stderr.write(`Missing command: ${command}\n`)
    process.exit(1)
  }
}
process.stdout.write('IELTS harness export matches templates and writing path.\n')
