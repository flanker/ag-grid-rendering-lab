import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'

const json = async path => JSON.parse(await readFile(path, 'utf8'))
const primary = await json('artifacts/primary/raw.json')
const cpu6 = await json('artifacts/cpu6/raw.json')
const visual = await json('artifacts/visual-published/result.json')
const checks = await json('artifacts/check/result.json')
const manifest = await json('dist/build-manifest.json')
assert.equal(primary.runs.length, 150)
assert.equal(cpu6.runs.length, 45)
assert.ok(primary.finishedAt && cpu6.finishedAt && visual.pass && checks.pass)
for (const measurement of [primary, cpu6, visual]) assert.equal(measurement.manifest.sourceSha256, manifest.sourceSha256)
const modes = ['react', 'dom-cells', 'dom-rows']
const scenarios = ['read', 'wheel', 'fling', 'fling-stop', 'hscroll']
const inputs = { read: { speed: 1200, distance: 3600 }, wheel: { speed: 3600, distance: 10800 }, fling: { speed: 9000, distance: 13500 }, 'fling-stop': { speed: 9000, distance: 13500, holdMs: 750 }, hscroll: { speed: 2400, distance: 4800, horizontal: true } }
const median = values => [...values].sort((a, b) => a - b)[Math.ceil(values.length / 2) - 1]
for (const [measurement, rates, repeats] of [[primary, [1, 4], 5], [cpu6, [6], 3]]) {
  const expected = rates.flatMap(cpu => Array.from({ length: repeats }, (_, block) => modes.flatMap(mode => scenarios.map(scenario => `${cpu}:${block}:${mode}:${scenario}`)))).flat()
  const actual = measurement.runs.map(run => `${run.cpu}:${run.block}:${run.mode}:${run.scenario}`)
  assert.equal(new Set(actual).size, actual.length, 'No duplicate timing conditions')
  assert.deepEqual(actual.sort(), expected.sort(), 'Complete unique timing matrix')
  const saved = await json(measurement === primary ? 'artifacts/primary/summary.json' : 'artifacts/cpu6/summary.json')
  const summary = [], paired = []
  for (const cpu of rates) for (const scenario of scenarios) {
    for (const mode of modes) {
      const runs = measurement.runs.filter(run => run.cpu === cpu && run.scenario === scenario && run.mode === mode)
      const p95s = runs.map(run => run.timing.p95)
      assert.ok(p95s.every(Number.isFinite))
      summary.push({ cpu, scenario, mode, n: runs.length, p95Median: median(p95s), p95Min: Math.min(...p95s), p95Max: Math.max(...p95s), p95Samples: p95s, medianIdle: median(runs.map(run => run.idle.p50)), longTasksTotal: runs.reduce((sum, run) => sum + run.timing.longTasks.length, 0), intervalsAbove2xIdle: runs.map(run => run.timing.intervals.filter(value => value > run.idle.p50 * 2).length), intervalsTotal: runs.map(run => run.timing.intervals.length) })
    }
    const comparisons = Array.from({ length: repeats }, (_, block) => {
      const p95 = Object.fromEntries(measurement.runs.filter(run => run.cpu === cpu && run.scenario === scenario && run.block === block).map(run => [run.mode, run.timing.p95]))
      return { block, domCellsMinusReactMs: p95['dom-cells'] - p95.react, domRowsMinusDomCellsMs: p95['dom-rows'] - p95['dom-cells'], domRowsMinusReactMs: p95['dom-rows'] - p95.react }
    })
    paired.push({ cpu, scenario, comparisons, meaning: 'Negative means lower p95 in the second implementation; paired blocks, not proof of general significance' })
  }
  assert.deepEqual(saved, { source: 'raw.json', summary, paired }, 'Summary recomputed from raw observations')
}
assert.deepEqual(checks.modes.map(item => item.mode).sort(), [...modes].sort())
for (const item of checks.modes) {
  assert.equal(item.meta.build, primary.manifest.revision)
  assert.equal(item.meta.hash, 'fde854ae')
  assert.deepEqual(item.errors, [])
}
assert.equal(checks.assertions.length, 48)
assert.deepEqual(visual.runs.map(run => `${run.cpu}:${run.mode}`).sort(), [1, 4, 6].flatMap(cpu => modes.map(mode => `${cpu}:${mode}`)).sort())
for (const run of visual.runs) {
  assert.deepEqual(run.errors, [])
  assert.ok(run.coverage.at(-1).complete)
  assert.ok(Math.abs(run.after.top - run.before.top - run.input.distance) <= 2)
}
assert.equal(visual.calibration.length, 7)
assert.deepEqual(visual.calibration.map(item => item.name).sort(), ['normal-rich', 'normal-sparse', 'empty', 'wrong-content', 'missing-content', 'ancestor-hidden', 'moved-content'].sort())
assert.ok(visual.calibration.every(item => item.pass))
for (const run of [...primary.runs, ...cpu6.runs]) {
  assert.equal(run.errors.length, 0)
  assert.equal(run.meta.hash, 'fde854ae')
  assert.deepEqual(run.meta.config, { mode: run.mode, preset: 'rich', rows: 500, columns: 60, seed: 16692 })
  assert.deepEqual(run.input, inputs[run.scenario])
  assert.equal(run.before.top, 0)
  assert.equal(run.before.left, 0)
  assert.ok(Math.abs(run.completedDistance - run.input.distance) <= 2)
  assert.ok(run.timing.longTaskSupported)
}
await mkdir('public/results', { recursive: true })
for (const [source, target] of [['artifacts/primary', 'primary'], ['artifacts/cpu6', 'cpu6'], ['artifacts/visual-published', 'visual'], ['artifacts/check', 'check']]) await cp(source, `public/results/${target}`, { recursive: true })
const verification = { verifiedAt: new Date().toISOString(), testedSourceSha256: manifest.sourceSha256, testedBuild: primary.manifest.revision, mainRuns: primary.runs.length, exploratoryRuns: cpu6.runs.length, functionalAssertions: checks.assertions.length, visualCalibrationCases: visual.calibration.length, visualRuns: visual.runs.length, allDisplacementsValid: true, browserErrors: 0 }
verification.measurementToolsSha256 = Object.fromEntries(await Promise.all(['scripts/bench.mjs', 'scripts/visual.mjs', 'scripts/check.mjs', 'scripts/browser.mjs', 'scripts/coverage.mjs'].map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])))
verification.evidenceSha256 = Object.fromEntries(await Promise.all(['primary/raw.json', 'primary/summary.json', 'cpu6/raw.json', 'cpu6/summary.json', 'visual/result.json', 'check/result.json'].map(async path => [path, createHash('sha256').update(await readFile(`public/results/${path}`)).digest('hex')])))
await writeFile('public/results/verification.json', JSON.stringify(verification, null, 2))
console.log(JSON.stringify(verification, null, 2))
