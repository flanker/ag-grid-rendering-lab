import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { launch, MODES } from './browser.mjs'

const base = process.env.BASE_URL || 'https://flanker.github.io/ag-grid-rendering-lab/'
const browser = await launch()
const result = { base, checkedAt: new Date().toISOString(), pages: [], checks: [] }
await mkdir('artifacts/live', { recursive: true })
try {
  const manifest = await (await fetch(`${base}build-manifest.json`)).json()
  const accepted = JSON.parse(await readFile('public/results/acceptance.json', 'utf8'))
  const liveAccepted = await (await fetch(`${base}results/acceptance.json`)).json()
  assert.deepEqual(liveAccepted, accepted, 'Published acceptance matches the reviewed local record')
  const verification = await (await fetch(`${base}results/verification.json`)).json()
  assert.deepEqual(verification, JSON.parse(await readFile('public/results/verification.json', 'utf8')))
  for (const [path, hash] of Object.entries(verification.evidenceSha256)) {
    const response = await fetch(`${base}results/${path}`)
    assert.ok(response.ok)
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), hash, `Published evidence hash: ${path}`)
  }
  assert.equal(manifest.sourceSha256, accepted.testedSourceSha256)
  result.manifest = manifest
  result.acceptance = liveAccepted
  result.checks.push('Published source fingerprint matches measured and accepted source')
  for (const mode of MODES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
    const errors = [], requests = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', entry => { if (entry.type() === 'error') errors.push(entry.text()) })
    page.on('request', request => requests.push(request.url()))
    const response = await page.goto(`${base}${mode}/`, { waitUntil: 'networkidle' })
    assert.equal(response.status(), 200)
    await page.waitForSelector('[data-content-id]')
    assert.equal(await page.locator('.grid-frame').getAttribute('data-mode'), mode)
    assert.equal(await page.evaluate(() => typeof window.__LAB__), 'undefined')
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '记录一次手动滚动' }).click()
    await page.mouse.move(800, 650)
    await page.mouse.wheel(0, 1500)
    await page.waitForSelector('.metric-row', { timeout: 15000 })
    const downloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: '导出 JSON ↓' }).click()
    const download = await downloadEvent
    await download.saveAs(`artifacts/live/${mode}-manual.json`)
    const record = JSON.parse(await readFile(`artifacts/live/${mode}-manual.json`, 'utf8'))
    assert.equal(record.config.mode, mode)
    assert.equal(record.fixtureModified, false)
    assert.ok(record.result.intervals.length > 0)
    const next = MODES[(MODES.indexOf(mode) + 1) % 3]
    await page.locator(`.mode-tabs a[href*="/${next}/"]`).click()
    await page.waitForSelector(`.grid-frame[data-mode="${next}"]`)
    assert.ok(requests.every(url => url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')), 'No unexpected network dependency')
    assert.deepEqual(errors, [])
    result.pages.push({ mode, status: response.status(), errors, requests: [...new Set(requests)], manualExport: true, testApiAbsent: true, reload: true, modeNavigation: true })
    await page.close()
  }
  const page = await browser.newPage()
  assert.equal((await page.goto(`${base}report.html`, { waitUntil: 'networkidle' })).status(), 200)
  await page.waitForFunction(() => document.querySelectorAll('#timing tr').length === 10)
  assert.equal(await page.locator('#visual tr').count(), 9)
  const summary = await (await fetch(`${base}results/primary/summary.json`)).json()
  const visual = await (await fetch(`${base}results/visual/result.json`)).json()
  assert.deepEqual(summary, JSON.parse(await readFile('public/results/primary/summary.json', 'utf8')))
  assert.deepEqual(visual, JSON.parse(await readFile('public/results/visual/result.json', 'utf8')))
  const timingRows = await page.locator('#timing tr').allTextContents()
  let row = 0
  for (const cpu of [1, 4]) for (const scenario of ['read', 'wheel', 'fling', 'fling-stop', 'hscroll']) {
    for (const mode of MODES) {
      const value = summary.summary.find(item => item.cpu === cpu && item.scenario === scenario && item.mode === mode)
      assert.equal(value.n, 5)
      assert.ok([value.p95Median, value.p95Min, value.p95Max].every(Number.isFinite))
      assert.ok(timingRows[row].includes(`${value.p95Median.toFixed(1)} (${value.p95Min.toFixed(1)}–${value.p95Max.toFixed(1)})`))
    }
    row++
  }
  const visualRows = await page.locator('#visual tr').allTextContents()
  visual.runs.forEach((run, index) => assert.ok(visualRows[index].includes(`${run.blankSamples} / ${run.sampledImages}`)))
  assert.deepEqual(visual.runs.map(run => `${run.cpu}:${run.mode}`).sort(), [1, 4, 6].flatMap(cpu => MODES.map(mode => `${cpu}:${mode}`)).sort())
  assert.ok(visual.runs.every(run => run.coverage.at(-1).complete))
  assert.equal(await page.locator('#evidence img').count(), 3)
  await page.waitForFunction(() => [...document.querySelectorAll('#evidence img')].every(image => image.complete && image.naturalWidth > 0))
  assert.equal(await page.locator('#outcome').innerText(), accepted.headline)
  assert.equal(await page.locator('#acceptance').innerText(), accepted.details)
  for (const path of ['results/primary/raw.json', 'results/cpu6/raw.json', 'results/verification.json']) assert.ok((await fetch(`${base}${path}`)).ok)
  await page.screenshot({ path: 'artifacts/live/report.png', fullPage: true })
  result.checks.push('Published report values match all ten timing rows and nine visual rows; raw evidence is accessible; online acceptance matches the reviewed record')
  result.pass = true
  await writeFile('artifacts/live/result.json', JSON.stringify(result, null, 2))
  console.log(JSON.stringify({ pass: true, pages: result.pages.length, checks: result.checks }, null, 2))
} finally { await browser.close() }
