# Measured results

The experiment reproduces CPU-pressure-sensitive scrolling. It does **not** establish that removing React field content fixes the problem, or that native row/cell containers eliminate blank content.

## Frozen primary measurement

Measured on 2026-09-07 using Apple M3 Pro (12 logical CPUs), macOS Darwin 25.6.0 arm64, headless Chromium 148.0.7778.96, viewport 1440 × 1000, DPR 1. Idle rAF interval median was approximately 8.3 ms. The page was a local production build; no screencast or trace ran during timing.

Renderer source fingerprint: `6a9d3993a84cac0d1cb6363ec9857790a5ec12ffd857079b8430a4df3f907f0a`. Frozen build revision: `e69a3f5`. Rich fixture: 500 rows × 60 columns, seed 16692, full-value hash `fde854ae`. A/B/C use the same field data and semantic content tree.

There are 150 primary observations: two CPU conditions × five sequential paired blocks × three implementations × five scenarios. All requested scroll displacements were completed within 2 px and no browser errors occurred. Each cell below is the median of five per-gesture P95 rAF callback intervals, in milliseconds. These are **not displayed FPS or input-to-paint latency**.

| CPU | Scenario | A React | B DOM content | C DOM rows/cells |
| --- | --- | ---: | ---: | ---: |
| 1× | read | 9.5 | 9.4 | 9.4 |
| 1× | wheel | 9.1 | 9.4 | 9.0 |
| 1× | fast wheel (`fling`) | 9.7 | 9.6 | 10.1 |
| 1× | fast wheel before hold | 10.0 | 9.4 | 9.7 |
| 1× | horizontal | 10.1 | 9.9 | 10.0 |
| 4× | read | 17.7 | 17.7 | 17.4 |
| 4× | wheel | 25.1 | 25.3 | 24.9 |
| 4× | fast wheel (`fling`) | 49.7 | 50.6 | 48.9 |
| 4× | fast wheel before hold | 42.9 | 50.1 | 42.3 |
| 4× | horizontal | 17.1 | 17.9 | 16.7 |

`fling` is the script's label for a controlled mouse-source wheel gesture at 9000 px/s for 13500 px, with additional inertial fling disabled. The 750 ms hold is recorded separately and is not included in the preceding gesture P95.

## What the measurements support

- CPU pressure substantially increases callback intervals in all three implementations. In A, ordinary wheel P95 rises from 9.1 to 25.1 ms and fast wheel from 9.7 to 49.7 ms. Normal-speed results at 1× are close; no long tasks were observed in the 1× timing runs.
- B does not show a consistent benefit over A. At 4× fast wheel it had a higher P95 in all five paired blocks and 17 observed long tasks across those five gestures, versus none in A. The fast-wheel-before-hold case also contains a B outlier; it is retained, not discarded.
- C improves over B in all five 4× fast-wheel blocks, but is **not consistently better than A**. The C−A paired differences are −1.1, +7.2, −7.0, −6.4 and +0.5 ms. Their mixed direction and the small difference between aggregate medians do not establish a reliable general advantage.
- Ordinary 4× wheel medians are close (25.1 / 25.3 / 24.9 ms). Small differences in this limited single-host sample should not be promoted into a universal performance claim.

The published report exposes ranges and every paired difference alongside the raw intervals. There is no statistical-significance or real-low-end-hardware certification claim. HTML parsing versus React element construction, and upstream native versus React scheduling, remain part of the implementation comparison.

## Separate visual diagnostics

Seven calibration cases passed, including valid rich/sparse content and intentionally empty, wrong, missing, ancestor-hidden and offscreen content. One diagnostic per CPU/mode captured compositor image samples during the fast-wheel command:

| CPU | A blank / active samples | B blank / active samples | C blank / active samples |
| --- | ---: | ---: | ---: |
| 1× | 0 / 142 | 0 / 142 | 0 / 143 |
| 4× | 131 / 145 | 131 / 143 | 117 / 142 |
| 6× | 136 / 144 | 135 / 142 | 136 / 144 |

Large blank regions remain in **all three** implementations under 4×/6× fast scrolling. Representative flagged and final images were visually inspected. All nine runs completed the requested 13500 px displacement and had correct, complete visible content at the first post-acknowledgement observation and every later observation. This is left-censored evidence, not a zero-millisecond recovery claim.

These are sampled images from a separate instrumented run, not every display frame, repeated performance trials or a percentage improvement estimate. No white-region diagnostic was collected concurrently with the primary timing runs.

## Exploratory 6× timing

The additional 45 observations use three paired blocks. Fast-wheel P95 medians were A 117.2, B 124.3 and C 115.3 ms; ordinary wheel medians were 42.6, 43.1 and 41.3 ms. All three remain CPU-pressure-sensitive. This exploratory condition does not replace the 1×/4× primary comparison.

## Functional and publication acceptance

The frozen build passed 48 visible-content assertions plus render-path checks, cross-mode normalized content/style parity, updates, sorting, horizontal/vertical scrolling, pinning/resizing, all presets, stress size, mobile layout and three same-page remounts. Native row creation minus destruction matched live native rows after each remount. Custom editors, full-width/spanned rows and enterprise features are excluded.

GitHub Pages acceptance is a separate gate. Its record verifies direct URLs, reloads, navigation, manual measurement/export, matching source/evidence hashes, exact displayed report values and loaded diagnostic images. See the published acceptance JSON and critical review log for the current deployed status and score.
