import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { cpus, platform, arch, release } from "node:os";
import {
  launch,
  openPage,
  gesture,
  metadata,
  sleep,
  reset,
  MODES,
} from "./browser.mjs";

const flags = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=")];
  }),
);
const base = flags.base || "http://127.0.0.1:4173/";
const preset = flags.preset || "rich";
const size = flags.size || "standard";
const repeats = Number(flags.repeat || 5);
const rates = (flags.cpu || "1,4").split(",").map(Number);
const out = flags.out || "artifacts/benchmark";
const cases = {
  read: { speed: 1200, distance: 3600 },
  wheel: { speed: 3600, distance: 10800 },
  fling: { speed: 9000, distance: 13500 },
  "fling-stop": { speed: 9000, distance: 13500, holdMs: 750 },
  hscroll: { speed: 2400, distance: 4800, horizontal: true },
};
const scenarios = (flags.scenarios || Object.keys(cases).join(",")).split(",");
assert.ok(repeats > 0 && repeats <= 20);
assert.ok(rates.every((rate) => [1, 4, 6].includes(rate)));
assert.ok(scenarios.every((name) => cases[name]));
await mkdir(out, { recursive: true });
const manifest = await (await fetch(`${base}build-manifest.json`)).json();
const result = {
  schema: 1,
  kind: "untraced timing; rAF callback intervals are not displayed FPS",
  command: `node scripts/bench.mjs ${process.argv.slice(2).join(" ")}`,
  startedAt: new Date().toISOString(),
  environment: {
    os: platform(),
    release: release(),
    arch: arch(),
    cpu: cpus()[0]?.model,
    logicalCpus: cpus().length,
  },
  base,
  manifest,
  protocol: {
    repeats,
    rates,
    preset,
    size,
    cases,
    scenarios,
    order:
      "rotated and reversed ABC blocks; sequential pages; no trace or screencast",
  },
  runs: [],
};
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ??
    null
  );
};
const position = (page) =>
  page.evaluate(() => {
    const element = document.querySelector(".ag-grid-viewport");
    return {
      top: element.scrollTop,
      left: element.scrollLeft,
      maxTop: element.scrollHeight - element.clientHeight,
      maxLeft: element.scrollWidth - element.clientWidth,
    };
  });
const browser = await launch();
try {
  result.browserVersion = browser.version();
  for (const cpu of rates)
    for (let block = 0; block < repeats; block++) {
      const rotated = [...MODES.slice(block % 3), ...MODES.slice(0, block % 3)];
      const order = block % 2 ? rotated.reverse() : rotated;
      for (const mode of order) {
        const { page, cdp, rect, errors } = await openPage(browser, {
          base,
          mode,
          preset,
          size,
          cpu,
        });
        await gesture(cdp, rect, { speed: 1200, distance: 1200 });
        await reset(page);
        const meta = await metadata(page);
        assert.equal(meta.config.mode, mode);
        assert.equal(meta.renderPath.nativeRows > 0, mode === "dom-rows");
        assert.equal(meta.renderPath.reactContents > 0, mode === "react");
        const idle = await page.evaluate(async () => {
          const stop = window.__LAB__.startTiming();
          await new Promise((r) => setTimeout(r, 700));
          return stop();
        });
        for (const scenario of scenarios) {
          await reset(page);
          const before = await position(page);
          await page.evaluate(() => {
            window.__stopTiming = window.__LAB__.startTiming();
          });
          const start = performance.now();
          const input = cases[scenario];
          await gesture(cdp, rect, input);
          const gestureWallMs = performance.now() - start;
          const timing = await page.evaluate(() => window.__stopTiming());
          const afterGesture = await position(page);
          let holdTiming = null;
          if (input.holdMs) {
            await page.evaluate(() => {
              window.__stopHold = window.__LAB__.startTiming();
            });
            await sleep(input.holdMs);
            holdTiming = await page.evaluate(() => window.__stopHold());
          }
          const after = await position(page);
          const distance = input.horizontal
            ? after.left - before.left
            : after.top - before.top;
          assert.ok(
            Math.abs(distance - input.distance) <= 2,
            `${mode} ${scenario}: completed ${distance}, requested ${input.distance}`,
          );
          assert.deepEqual(
            errors,
            [],
            "No browser errors during formal measurement",
          );
          const run = {
            cpu,
            block,
            order,
            mode,
            scenario,
          input,
          rect,
            meta,
            idle,
            before,
            afterGesture,
            after,
            completedDistance: distance,
            gestureWallMs,
            timing,
            holdTiming,
            errors: [...errors],
          };
          result.runs.push(run);
          await writeFile(`${out}/raw.json`, JSON.stringify(result, null, 2));
          console.log(
            `${cpu}x block ${block + 1}/${repeats} ${mode.padEnd(9)} ${scenario.padEnd(10)} p95=${timing.p95.toFixed(1)} max=${timing.max.toFixed(1)} long=${timing.longTasks.length} distance=${distance}`,
          );
        }
        await page.close();
      }
    }
  result.finishedAt = new Date().toISOString();
  await writeFile(`${out}/raw.json`, JSON.stringify(result, null, 2));
  const summary = [];
  for (const cpu of rates)
    for (const scenario of scenarios)
      for (const mode of MODES) {
        const runs = result.runs.filter(
          (run) =>
            run.cpu === cpu && run.scenario === scenario && run.mode === mode,
        );
        const p95s = runs.map((run) => run.timing.p95);
        summary.push({
          cpu,
          scenario,
          mode,
          n: runs.length,
          p95Median: percentile(p95s, 0.5),
          p95Min: Math.min(...p95s),
          p95Max: Math.max(...p95s),
          p95Samples: p95s,
          medianIdle: percentile(
            runs.map((r) => r.idle.p50),
            0.5,
          ),
          longTasksTotal: runs.reduce(
            (sum, run) => sum + run.timing.longTasks.length,
            0,
          ),
          intervalsAbove2xIdle: runs.map(
            (run) =>
              run.timing.intervals.filter((t) => t > run.idle.p50 * 2).length,
          ),
          intervalsTotal: runs.map((run) => run.timing.intervals.length),
        });
      }
  const paired = [];
  for (const cpu of rates)
    for (const scenario of scenarios) {
      const comparisons = [];
      for (let block = 0; block < repeats; block++) {
        const p95 = Object.fromEntries(
          result.runs
            .filter(
              (run) =>
                run.cpu === cpu &&
                run.scenario === scenario &&
                run.block === block,
            )
            .map((run) => [run.mode, run.timing.p95]),
        );
        comparisons.push({
          block,
          domCellsMinusReactMs: p95["dom-cells"] - p95.react,
          domRowsMinusDomCellsMs: p95["dom-rows"] - p95["dom-cells"],
          domRowsMinusReactMs: p95["dom-rows"] - p95.react,
        });
      }
      paired.push({
        cpu,
        scenario,
        comparisons,
        meaning:
          "Negative means lower p95 in the second implementation; paired blocks, not proof of general significance",
      });
    }
  await writeFile(
    `${out}/summary.json`,
    JSON.stringify({ source: "raw.json", summary, paired }, null, 2),
  );
  console.log(`Saved ${result.runs.length} observations to ${out}`);
} finally {
  await browser.close();
}
