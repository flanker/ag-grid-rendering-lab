import { mkdir, writeFile } from "node:fs/promises";
import { launch, openPage, gesture, metadata, sleep } from "./browser.mjs";

const out = process.env.BASELINE_OUT || "artifacts/baseline-v2";
await mkdir(out, { recursive: true });
const browser = await launch();
try {
  const { page, cdp, rect, errors } = await openPage(browser, { cpu: 4 });
  await page.screenshot({
    path: `${out}/page.png`,
    fullPage: true,
  });
  await gesture(cdp, rect, { speed: 1200, distance: 1200 });
  await sleep(500);
  const meta = await metadata(page);
  const idle = await page.evaluate(async () => {
    const stop = window.__LAB__.startTiming();
    await new Promise((r) => setTimeout(r, 1500));
    return stop();
  });
  const position = () =>
    page.evaluate(() => {
      const el = document.querySelector(".ag-grid-viewport");
      return { top: el.scrollTop, left: el.scrollLeft };
    });
  const before = await position();
  await page.evaluate(() => {
    window.__stopTiming = window.__LAB__.startTiming();
  });
  await gesture(cdp, rect, { speed: 3600, distance: 9000 });
  const timing = await page.evaluate(() => window.__stopTiming());
  const result = {
    meta,
    cpu: 4,
    gesture: {
      speed: 3600,
      distance: 9000,
      source: "CDP mouse scroll gesture",
    },
    before,
    after: await position(),
    idle,
    timing,
    errors,
  };
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        meta,
        idleP50: idle.p50,
        wheelP95: timing.p95,
        wheelMax: timing.max,
        longTasks: timing.longTasks.length,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
