import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { contentCoverage } from "./coverage.mjs";
import {
  launch,
  openPage,
  metadata,
  snapshot,
  gesture,
  sleep,
  MODES,
  reset,
} from "./browser.mjs";

const base = process.env.BASE_URL || "http://127.0.0.1:4173/";
const modes = process.env.MODES?.split(",") || MODES;
const out = process.env.CHECK_OUT || "artifacts/check";
await mkdir(out, { recursive: true });
const browser = await launch();
const result = {
  base,
  checkedAt: new Date().toISOString(),
  modes: [],
  assertions: [],
};
const references = new Map();
try {
  for (const mode of modes) {
    const { page, cdp, rect, errors } = await openPage(browser, {
      base,
      mode,
      lifecycle: true,
    });
    const meta = await metadata(page);
    const native = mode === "dom-rows";
    assert.ok(meta.renderPath.rows > 10);
    assert.equal(
      meta.renderPath.reactRows > 0,
      !native,
      `${mode} row implementation`,
    );
    assert.equal(
      meta.renderPath.nativeRows > 0,
      native,
      `${mode} native row implementation`,
    );
    assert.equal(
      meta.renderPath.reactCells > 0,
      !native,
      `${mode} cell shell implementation`,
    );
    assert.equal(
      meta.renderPath.reactContents > 0,
      mode === "react",
      `${mode} content implementation`,
    );
    const compare = async (label) => {
      await sleep(300);
      const coverage = await contentCoverage(page);
      assert.equal(
        coverage.complete,
        true,
        `${mode} ${label} full visible coverage: ${JSON.stringify(coverage)}`,
      );
      const current = await snapshot(page);
      assert.ok(
        Object.keys(current).length > 50,
        "grid should contain many rendered cells",
      );
      const reference = references.get(label);
      if (reference) {
        const overlap = Object.keys(current).filter((key) => key in reference);
        assert.ok(overlap.length > 50, `${label} shared cell identities`);
        for (const key of overlap)
          assert.deepEqual(
            current[key],
            reference[key],
            `${mode} ${label} ${key}`,
          );
      } else references.set(label, current);
      const bad = await page.evaluate(() =>
        [...document.querySelectorAll("[data-content-id]")]
          .filter((el) => {
            const [row, col] = el.dataset.contentId.split(":");
            return el.dataset.value !== window.__LAB__.expected(row, col);
          })
          .map((el) => el.dataset.contentId),
      );
      assert.deepEqual(bad, [], `${mode} ${label} stale content`);
      result.assertions.push(
        `${mode}: ${label} content matches expected data and other modes`,
      );
    };
    await compare("initial");
    const distribution = await page.evaluate(() => {
      const rows = window.__LAB__.data;
      return {
        names: new Set(rows.map((r) => r.values[3].text)).size,
        statuses: new Set(rows.map((r) => r.values[11].n % 4)).size,
        booleans: new Set(rows.map((r) => r.values[12].n % 2)).size,
        thumbnailPalettes: new Set(rows.map((r) => r.values[1].n % 4)).size,
      };
    });
    assert.deepEqual(distribution, {
      names: 8,
      statuses: 4,
      booleans: 2,
      thumbnailPalettes: 4,
    });
    await page.screenshot({
      path: `${out}/${mode}-desktop.png`,
      fullPage: true,
    });
    await page
      .locator(".grid-frame")
      .screenshot({ path: `${out}/${mode}-grid.png` });
    await gesture(cdp, rect, { speed: 9000, distance: 6000 });
    await compare("after vertical wheel");
    await gesture(cdp, rect, { speed: 2400, distance: 1800, horizontal: true });
    await compare("after horizontal wheel");
    await reset(page);
    await compare("initial");
    const lifecycleRuns = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      const before = await page.evaluate(() => {
        window.__oldApi = window.__LAB__.api;
        window.__oldRows = [...document.querySelectorAll(".ag-row[row-id]")];
        const counts = window.__LAB__.lifecycle
          ? { ...window.__LAB__.lifecycle }
          : null;
        window.__LAB__.remount();
        return counts;
      });
      await page.waitForFunction(
        () =>
          window.__LAB__.api !== window.__oldApi &&
          window.__oldApi.isDestroyed(),
      );
      await compare("initial");
      const after = await page.evaluate(() => ({
        ...window.__LAB__.lifecycle,
        oldRowsDisconnected: window.__oldRows.every((el) => !el.isConnected),
        rowCount: document.querySelectorAll(".ag-row[row-id]").length,
      }));
      assert.equal(after.oldRowsDisconnected, true);
      if (native) {
        assert.ok(
          after.destroyed > before.destroyed,
          "old native components must call destroy",
        );
        assert.equal(
          after.created - after.destroyed,
          after.rowCount,
          "all live native components correspond to current DOM rows",
        );
      }
      lifecycleRuns.push({ before, after });
    }
    await page.getByRole("button", { name: "验证首行更新 ↻" }).click();
    await compare("after data update");
    await page.evaluate(() =>
      window.__LAB__.api.applyColumnState({
        state: [{ colId: "c0", sort: "desc" }],
        defaultState: { sort: null },
      }),
    );
    await compare("after sort");
    await page.evaluate(() =>
      window.__LAB__.api.applyColumnState({
        state: [
          { colId: "c0", sort: null, width: 210 },
          { colId: "c1", pinned: "left" },
        ],
        defaultState: { sort: null },
      }),
    );
    await compare("after resize and pin");
    await page.reload({ waitUntil: "networkidle" });
    await compare("initial");
    for (const preset of ["rating", "attachments", "tags", "plain"]) {
      await page.getByLabel("字段组合").selectOption(preset);
      await page.waitForFunction(
        (p) => window.__LAB__?.config.preset === p,
        preset,
      );
      await compare(`preset ${preset}`);
    }
    await page.getByLabel("数据规模").selectOption("stress");
    await page.waitForFunction(() => window.__LAB__?.config.rows === 5000);
    assert.equal(
      await page.evaluate(() => window.__LAB__.api.getDisplayedRowCount()),
      5000,
    );
    await page.getByLabel("字段组合").selectOption("rich");
    await page.waitForFunction(() => window.__LAB__?.config.preset === "rich");
    await compare("stress rich");
    await page.setViewportSize({ width: 390, height: 844 });
    await sleep(300);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "no page-level horizontal overflow",
    );
    await page.screenshot({
      path: `${out}/${mode}-mobile.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "实验说明 +" }).click();
    assert.ok(await page.getByText("如何复现与比较").isVisible());
    const links = await page
      .locator(".mode-tabs a")
      .evaluateAll((elements) => elements.map((el) => el.href));
    assert.ok(
      links.every(
        (link) => link.startsWith(base) && link.includes("size=stress"),
      ),
    );
    assert.deepEqual(errors, [], `${mode} browser errors`);
    await page.goto(`${base}${mode}/index.html?test=1`, {
      waitUntil: "networkidle",
    });
    assert.equal(await page.evaluate(() => window.__LAB__.config.mode), mode);
    result.modes.push({ mode, meta, errors, distribution, lifecycleRuns });
    await page.close();
  }
  result.pass = true;
  await writeFile(`${out}/result.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      { pass: true, modes, assertions: result.assertions.length, output: out },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
