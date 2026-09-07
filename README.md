# AG Grid Rendering Lab

Three static React pages compare the cost of rendering rich AG Grid cells and data rows. All content is deterministic synthetic data. No backend, login, external images, or enterprise license is required.

**Live experiment:** https://flanker.github.io/ag-grid-rendering-lab/

| Page | Field content | Data row/cell containers |
| --- | --- | --- |
| [A — React baseline](https://flanker.github.io/ag-grid-rendering-lab/react/) | React | React |
| [B — DOM content](https://flanker.github.io/ag-grid-rendering-lab/dom-cells/) | HTML/template DOM renderer | React |
| [C — DOM rows and cells](https://flanker.github.io/ag-grid-rendering-lab/dom-rows/) | Same DOM renderer as B | Native AG Grid components |

React / React DOM **19.2.1**. AG Grid Community / React **36.0.2**. Dependencies are pinned and checked during build. C still has a React application and `AgGridReact` entry point.

## Run locally

Node 22 and pnpm 10.33.4:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
pnpm build
pnpm preview
```

Open http://127.0.0.1:4173/react/. Use the same field preset and data size across all three pages. Standard data is 500 × 60; stress is 5000 × 50. Presets show mixed rich fields, ratings, attachments, tags, or plain text/numbers. Sorting, resizing, pinning through the test harness, and data updates are supported; custom editors and enterprise features are outside this experiment.

The manual 10-second recorder is exploratory. CPU throttling must be set in Chrome DevTools. Its rAF intervals measure main-thread callback responsiveness, **not displayed FPS**. Downloaded manual results identify modified fixtures.

## Reproduce the automated checks

With the production preview running:

```sh
pnpm check
pnpm bench --cpu=1,4 --repeat=5 --out=artifacts/primary
pnpm bench --cpu=6 --repeat=3 --out=artifacts/cpu6
VISUAL_OUT=artifacts/visual-published node scripts/visual.mjs
```

`scripts/bench.mjs` uses Chromium mouse-source CDP scroll gestures. It verifies completed displacement, calibrates idle rAF intervals, and records each raw observation. Timing runs have no screencast or trace. Runs are sequential, with rotated/reversed A/B/C order. Do not run other browser checks or CPU-intensive tools simultaneously with the benchmark.

Visual diagnostics run separately. Known empty, wrong, missing and valid rich/sparse examples calibrate the classifiers. Screencast images are samples, not every display frame. Content coverage checks the independently expected visible identities and actual text. Post-command readiness is measured after the CDP gesture acknowledgement, not as complete input-to-paint latency.

`scripts/check.mjs` verifies render paths, complete visible coverage, parent row/column identity, cross-mode content/style parity, updates, sorting, scrolling, resizing, pinning, preset changes, stress size, mobile layout, explicit `index.html` entry points and same-page grid remounts. Native creation/destruction counters are enabled only with `?lifecycle=1`; benchmark runs leave them disabled. The test API is exposed only with `?test=1`.

Use `BASE_URL=https://flanker.github.io/ag-grid-rendering-lab/ pnpm check` to check the deployed build. Use `--base=https://flanker.github.io/ag-grid-rendering-lab/` for online benchmarks.

## Minimal native row bridge

[`tooling/native-row-bridge.mjs`](tooling/native-row-bridge.mjs) transforms the installed, unmodified public AG Grid 36.0.2 ESM sources during the Vite build. It exports the existing native `RowComp` and mounts/reuses/destroys it from the existing React row container when `context.vanillaRows` is true. The original React branch remains active for A/B. All modes use the same bundle.

There are **no** scheduler changes, directional buffers, extra lookahead, skeletons, hidden pointer overlays, busy loops or artificial layout work. C retains upstream native component scheduling, including its differences from the React path. The bridge relies on internal APIs and is an experiment, not a supported AG Grid option or a production-ready patch. React custom editors, full-width rows and row spans are not claimed as validated.

`build-manifest.json` records installed versions and hashes of the lockfile, bridge, upstream/transformed library sources and experiment source. Build anchors fail closed if the expected upstream structure changes.

## Results and limits

See the [published report](https://flanker.github.io/ag-grid-rendering-lab/report.html), [experiment protocol](EXPERIMENT.md), and [critical reviews](REVIEWS.md). Raw results are linked from the report. Preliminary single runs are not used as proof of improvement.

Final independent acceptance: **9.0/10**, including deployed functionality and evidence identity. CPU-pressure scrolling problems were reproduced; B did not consistently improve over A, and C did not eliminate blank content. See [measured results](RESULTS.md) for the limits of the comparison.

This tests synthetic renderers on Community, not a complete business application or enterprise configuration. CPU throttling simulates CPU pressure on this host and browser; it does not certify a real low-end device. Equivalent visual output does not imply identical construction: A creates React elements, B/C parse escaped HTML. Report implementation differences, noise, regressions and inconclusive outcomes honestly.

## Publish to GitHub Pages

The repository publishes prebuilt static files from its `gh-pages` branch, with `.nojekyll`. No application server or custom domain is required. Build locally, validate, and publish only the contents of `dist/`. The `main` branch contains source, protocol and reproducible evidence. The published manifest allows the tested and deployed source to be compared.

After the sequential checks above, run `node scripts/assemble-results.mjs`. Review the results, update `public/results/acceptance.json` with the actual assessment, and build. Run `pnpm publish:pages` to check the source fingerprint against acceptance before pushing static files. Configure GitHub Pages to publish `gh-pages` at `/`, then run `BASE_URL=https://flanker.github.io/ag-grid-rendering-lab/ CHECK_OUT=artifacts/live-check pnpm check` and `node scripts/live-smoke.mjs`. Updating result text alone does not invalidate the renderer source fingerprint; changing the experiment source requires new relevant measurements.

## License

Original experiment code is MIT licensed. React and AG Grid retain their own MIT copyright notices; see [THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt). No private application source or data is included.
