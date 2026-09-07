import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repo = 'flanker/ag-grid-rendering-lab'
const run = (cmd, args, cwd = process.cwd()) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
for (const file of ['index.html', 'react/index.html', 'dom-cells/index.html', 'dom-rows/index.html', 'report.html', 'build-manifest.json', 'results/acceptance.json', 'results/verification.json', 'results/primary/raw.json', 'results/primary/summary.json', 'results/cpu6/raw.json', 'results/cpu6/summary.json', 'results/visual/result.json', 'results/check/result.json']) {
  if (!existsSync(`dist/${file}`)) throw new Error(`Missing validated static output: ${file}`)
}
const manifest = JSON.parse(readFileSync('dist/build-manifest.json', 'utf8'))
const acceptance = JSON.parse(readFileSync('dist/results/acceptance.json', 'utf8'))
if (acceptance.testedSourceSha256 !== manifest.sourceSha256) throw new Error('Published source does not match the accepted experiment')
if (acceptance.localExperimentPassed !== true || !Number.isFinite(acceptance.measurementReviewScore) || acceptance.measurementReviewScore < 8.5) throw new Error('Local experiment must pass independent review before publishing')
const verification = JSON.parse(readFileSync('dist/results/verification.json', 'utf8'))
if (verification.testedSourceSha256 !== manifest.sourceSha256) throw new Error('Evidence belongs to a different experiment')
for (const [path, hash] of Object.entries(verification.evidenceSha256)) if (createHash('sha256').update(readFileSync(`dist/results/${path}`)).digest('hex') !== hash) throw new Error(`Evidence changed after validation: ${path}`)
const revision = run('git', ['rev-parse', '--short', 'HEAD'])
const remote = run('git', ['remote', 'get-url', 'origin'])
if (!remote.includes(`${repo}.git`) && !remote.endsWith(repo)) throw new Error('Unexpected GitHub repository')
const directory = mkdtempSync(join(tmpdir(), 'ag-grid-rendering-pages-'))
const existing = run('git', ['ls-remote', '--heads', remote, 'gh-pages'])
if (existing) run('git', ['clone', '--branch', 'gh-pages', '--single-branch', '--depth', '1', remote, directory])
else { run('git', ['init', '-b', 'gh-pages', directory]); run('git', ['remote', 'add', 'origin', remote], directory) }
if (run('git', ['branch', '--show-current'], directory) !== 'gh-pages' || !existsSync(join(directory, '.git'))) throw new Error('Expected dedicated deployment checkout')
run('git', ['rm', '-r', '--ignore-unmatch', '--', '.'], directory)
cpSync('dist', directory, { recursive: true })
run('git', ['add', '.'], directory)
if (run('git', ['status', '--porcelain'], directory)) {
  run('git', ['commit', '-m', `Deploy validated rendering experiment ${revision}`], directory)
  console.log(run('git', ['push', 'origin', 'gh-pages'], directory))
}
console.log(`Static deployment branch published from ${directory}`)
console.log('GitHub Pages source must be gh-pages / (root). Verify all three live pages after deployment finishes.')
