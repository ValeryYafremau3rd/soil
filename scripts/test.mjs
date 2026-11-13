import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverTests, selectTests } from './test-selection.mjs'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const testRoot = path.join(projectRoot, 'tests')
const files = discoverTests(testRoot)
const args = process.argv.slice(2)
const modules = [...new Set(files.map(file => file.split('/')[0]))]

if (args.includes('--help')) {
  console.log('Usage: npm test -- [module or test file ...] [name=pattern]')
  console.log('List files: npm run test:list -- [module or test file ...]')
  console.log('No selectors runs the full suite. Multiple selectors are combined without duplicates.')
  console.log('Modules: ' + modules.join(', '))
} else {
  try {
    const names = args.filter(arg => arg.startsWith('name=') || arg.startsWith('--name='))
    const selectors = args.filter(arg => arg !== '--list' && !names.includes(arg))
    const selected = selectTests(files, selectors)
    if (!selected.length) throw new Error('No tests discovered.')
    if (args.includes('--list')) {
      for (const module of modules) {
        const entries = selected.filter(file => file.startsWith(module + '/'))
        if (entries.length) console.log(`${module} (${entries.length} files)\n${entries.map(file => '  ' + file).join('\n')}`)
      }
    } else {
      const filters = names.map(arg => '--test-name-pattern=' + arg.slice(arg.indexOf('=') + 1))
      console.log(`Running ${selected.length} test files: ${selectors.join(', ') || 'all modules'}${names.length ? ' (' + names.join(', ') + ')' : ''}`)
      const child = spawn(process.execPath, ['--experimental-strip-types', '--test', '--test-reporter=spec', ...filters,
        ...selected.map(file => path.join(testRoot, file))], { cwd: projectRoot, stdio: 'inherit', windowsHide: true })
      child.on('error', error => { console.error(error.message); process.exitCode = 1 })
      child.on('exit', code => { process.exitCode = code ?? 1 })
    }
  } catch (error) {
    console.error(error.message)
    console.error('Available modules: ' + modules.join(', '))
    process.exitCode = 1
  }
}
