import { chromium } from "playwright";
export const MODES = ["react", "dom-cells", "dom-rows"];
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function launch() {
  return chromium.launch({
    channel: "chromium",
    headless: process.env.HEADED !== "1",
    args: [
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
}
export async function openPage(
  browser,
  {
    base = "http://127.0.0.1:4173/",
    mode = "react",
    preset = "rich",
    size = "standard",
    cpu = 1,
    lifecycle = false,
  } = {},
) {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.goto(
    `${base.replace(/\/?$/, "/")}${mode}/?preset=${preset}&size=${size}&test=1${lifecycle ? "&lifecycle=1" : ""}`,
    { waitUntil: "networkidle" },
  );
  await page.waitForFunction(
    () =>
      window.__LAB__?.api &&
      document.querySelectorAll("[data-content-id]").length > 50,
  );
  await sleep(500);
  const viewportRect = await page.locator(".ag-grid-viewport").boundingBox();
  if (!viewportRect) throw new Error("AG Grid viewport missing");
  const rect = {
    ...viewportRect,
    y: viewportRect.y + 40,
    height: viewportRect.height - 40,
  };
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return { page, cdp, errors, rect };
}
export async function reset(page) {
  await page.evaluate(() => {
    window.__LAB__.api.ensureIndexVisible(0, "top");
    window.__LAB__.api.ensureColumnVisible("c0", "start");
  });
  await sleep(400);
}
export async function gesture(
  cdp,
  rect,
  { speed = 3600, distance = 6000, horizontal = false, direction = 1 } = {},
) {
  await cdp.send("Input.synthesizeScrollGesture", {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
    xDistance: horizontal ? -distance * direction : 0,
    yDistance: horizontal ? 0 : -distance * direction,
    speed,
    gestureSourceType: "mouse",
    preventFling: true,
  });
}
export async function metadata(page) {
  return page.evaluate(() => {
    const lab = window.__LAB__;
    const rows = [...document.querySelectorAll(".ag-row[row-id]")];
    const cells = [...document.querySelectorAll(".ag-cell")];
    const fiber = (el) =>
      Object.keys(el).some((k) => k.startsWith("__reactFiber"));
    return {
      config: lab.config,
      hash: lab.hash,
      versions: lab.versions,
      userAgent: navigator.userAgent,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      build: document.querySelector("#build-id")?.textContent,
      renderPath: {
        rows: rows.length,
        reactRows: rows.filter(fiber).length,
        nativeRows: rows.filter((r) => r.hasAttribute("comp-id")).length,
        cells: cells.length,
        reactCells: cells.filter(fiber).length,
        reactContents: [
          ...document.querySelectorAll("[data-content-id]"),
        ].filter(fiber).length,
      },
    };
  });
}
export async function snapshot(page) {
  return page.evaluate(() => {
    const normal = (el) => {
      if (el.nodeType === Node.TEXT_NODE) return el.textContent;
      const attrs = [...el.attributes]
        .filter((a) =>
          [
            "class",
            "style",
            "title",
            "viewBox",
            "d",
            "fill",
            "opacity",
            "cx",
            "cy",
            "r",
            "width",
            "height",
            "data-content-id",
            "data-value",
          ].includes(a.name),
        )
        .map((a) => [a.name, a.name === "style" ? el.style.cssText : a.value])
        .sort();
      return [el.tagName, attrs, [...el.childNodes].map(normal)];
    };
    const cells = [...document.querySelectorAll("[data-content-id]")];
    return Object.fromEntries(
      cells
        .map((el) => [el.dataset.contentId, normal(el)])
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  });
}
