import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import jpeg from "jpeg-js";
import { cpus, platform, arch } from "node:os";
import {
  launch,
  openPage,
  gesture,
  metadata,
  sleep,
  reset,
  MODES,
} from "./browser.mjs";
import { contentCoverage } from "./coverage.mjs";

const base = process.env.BASE_URL || "http://127.0.0.1:4173/";
const out = process.env.VISUAL_OUT || "artifacts/visual-final";
await mkdir(out, { recursive: true });
function analyze(buffer, rect) {
  const image = jpeg.decode(buffer, { useTArray: true });
  const ratios = [];
  const x0 = Math.ceil(rect.x + 3),
    x1 = Math.floor(rect.x + rect.width - 18);
  const y0 = Math.ceil(rect.y + 2),
    y1 = Math.min(image.height, Math.floor(rect.y + rect.height - 16));
  for (let y = y0; y + 20 < y1; y += 40) {
    let dark = 0,
      pixels = 0;
    for (let yy = y; yy < Math.min(y + 40, y1); yy += 2)
      for (let x = x0; x < Math.min(image.width, x1); x += 2) {
        const i = (yy * image.width + x) * 4;
        if (Math.min(image.data[i], image.data[i + 1], image.data[i + 2]) < 190)
          dark++;
        pixels++;
      }
    ratios.push(dark / pixels);
  }
  const empty = ratios.filter((ratio) => ratio < 0.008).length;
  return {
    blank: ratios.length > 0 && empty / ratios.length >= 0.5,
    partial: empty > 0,
    emptyBands: empty,
    bands: ratios.length,
    emptyRatio: empty / ratios.length,
    inkRatios: ratios,
  };
}
const browser = await launch();
const result = {
  kind: "Separate visual diagnostics. Screencast images are samples, not all displayed frames. Visible DOM coverage is sampled after CDP gesture acknowledgement, not true input-to-paint latency. First-complete after-ack is a response-time upper bound; first sample already complete is left-censored.",
  base,
  command: "node scripts/visual.mjs",
  environment: { os: platform(), arch: arch(), cpu: cpus()[0]?.model },
  manifest: await (await fetch(`${base}build-manifest.json`)).json(),
  browserVersion: browser.version(),
  recordedAt: new Date().toISOString(),
  calibration: [],
  runs: [],
};
try {
  for (const [name, preset, mutation] of [
    ["normal-rich", "rich", "none"],
    ["normal-sparse", "plain", "none"],
    ["empty", "rich", "hide"],
    ["wrong-content", "rich", "wrong"],
    ["missing-content", "rich", "missing"],
    ["ancestor-hidden", "rich", "ancestor"],
    ["moved-content", "rich", "moved"],
  ]) {
    const { page, rect } = await openPage(browser, { base, preset });
    if (mutation === "hide")
      await page.addStyleTag({
        content: ".cell-content { visibility:hidden!important }",
      });
    if (mutation === "wrong")
      await page
        .locator("[data-content-id]")
        .first()
        .evaluate((el) => {
          el.textContent = "INCORRECT CONTENT";
        });
    if (mutation === "missing")
      await page
        .locator("[data-content-id]")
        .first()
        .evaluate((el) => el.remove());
    if (mutation === "ancestor")
      await page
        .locator("[data-content-id]")
        .first()
        .evaluate((el) => {
          el.closest(".ag-row").style.opacity = "0";
        });
    if (mutation === "moved")
      await page
        .locator("[data-content-id]")
        .first()
        .evaluate((el) => {
          el.style.transform = "translateX(20000px)";
        });
    const buffer = await page.screenshot({ type: "jpeg", quality: 85 });
    await writeFile(`${out}/calibration-${name}.jpg`, buffer);
    const analysis = analyze(buffer, rect);
    const coverage = await contentCoverage(page);
    assert.equal(
      analysis.blank,
      mutation === "hide",
      `${name} blank classifier`,
    );
    assert.equal(
      coverage.complete,
      mutation === "none",
      `${name} content classifier`,
    );
    result.calibration.push({ name, analysis, coverage, pass: true });
    await page.close();
  }
  for (const cpu of [1, 4, 6])
    for (const mode of MODES) {
      const { page, cdp, rect, errors } = await openPage(browser, {
        base,
        mode,
        cpu,
      });
      await gesture(cdp, rect, { speed: 1200, distance: 1200 });
      await reset(page);
      const meta = await metadata(page);
      const before = await contentCoverage(page);
      const frames = [];
      const capture = async (frame) => {
        frames.push(frame);
        await cdp
          .send("Page.screencastFrameAck", { sessionId: frame.sessionId })
          .catch(() => {});
      };
      cdp.on("Page.screencastFrame", capture);
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 85,
        maxWidth: 1440,
        maxHeight: 1000,
        everyNthFrame: 1,
      });
      await sleep(150);
      const started = Date.now();
      await gesture(cdp, rect, { speed: 9000, distance: 13500 });
      const acknowledged = Date.now();
      const coverage = [];
      for (let sample = 0; sample < 8; sample++) {
        const requestAfterAckMs = Date.now() - acknowledged;
        const observation = await contentCoverage(page);
        coverage.push({
          requestAfterAckMs,
          afterAckMs: Date.now() - acknowledged,
          ...observation,
        });
        await sleep(90);
      }
      await cdp.send("Page.stopScreencast");
      cdp.off("Page.screencastFrame", capture);
      const analyzed = frames.map((frame, index) => ({
        index,
        timestamp: frame.metadata.timestamp,
        metadata: frame.metadata,
        phase:
          frame.metadata.timestamp * 1000 < started
            ? "before"
            : frame.metadata.timestamp * 1000 <= acknowledged
              ? "command-active"
              : "after",
        ...analyze(Buffer.from(frame.data, "base64"), rect),
      }));
      const active = analyzed.filter(
        (frame) => frame.phase === "command-active",
      );
      assert.ok(
        active.length > 5,
        "compositor timestamps align with command-active window",
      );
      const flagged = active.filter((frame) => frame.blank).slice(0, 3);
      const images = [];
      for (const frame of flagged) {
        const filename = `${mode}-${cpu}x-blank-${frame.index}.jpg`;
        await writeFile(
          `${out}/${filename}`,
          Buffer.from(frames[frame.index].data, "base64"),
        );
        images.push(filename);
      }
      const samples = new Map();
      const worst = [...active].sort((a, b) => b.emptyRatio - a.emptyRatio)[0];
      samples.set(worst.index, "worst");
      for (const frame of active
        .filter((frame) => !frame.blank)
        .filter(
          (_, i, all) =>
            i === 0 || i === Math.floor(all.length / 2) || i === all.length - 1,
        ))
        samples.set(frame.index, "not-blank");
      for (const [index, label] of samples) {
        const filename = `${mode}-${cpu}x-${label}-${index}.jpg`;
        await writeFile(
          `${out}/${filename}`,
          Buffer.from(frames[index].data, "base64"),
        );
        images.push(filename);
      }
      await page.screenshot({ path: `${out}/${mode}-${cpu}x-final.png` });
      assert.equal(
        coverage.at(-1).complete,
        true,
        `${mode} ${cpu}x final visible content`,
      );
      assert.ok(
        Math.abs(coverage.at(-1).top - before.top - 13500) <= 2,
        "visual gesture completes requested displacement",
      );
      assert.deepEqual(errors, []);
      const run = {
        mode,
        cpu,
        rect,
        meta,
        input: {
          speed: 9000,
          distance: 13500,
          source: "CDP mouse scroll gesture",
        },
        before,
        after: coverage.at(-1),
        commandWallMs: acknowledged - started,
        allSampledImages: frames.length,
        sampledImages: active.length,
        blankSamples: active.filter((frame) => frame.blank).length,
        partialSamples: active.filter((frame) => frame.partial).length,
        firstCompleteObservedAfterAckMs:
          coverage.find((frame) => frame.complete)?.afterAckMs ?? null,
        leftCensored: coverage[0].complete,
        images,
        coverage,
        analyzed,
        errors,
      };
      result.runs.push(run);
      await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
      console.log(
        `${mode} ${cpu}x visual: blank samples ${run.blankSamples}/${active.length}, complete first post-ack sample=${coverage[0].complete}`,
      );
      await page.close();
    }
  result.pass = true;
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
