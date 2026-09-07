# Rendering experiment protocol

Status: protocol fixed before measurements. Performance results are not available yet.

## Question

With equivalent visible content, how do React field components and React grid row/cell containers affect wheel scrolling under CPU pressure? An improvement, regression, or inconclusive difference is a valid outcome.

This standalone synthetic reproduction uses React and React DOM 19.2.1 and AG Grid React / Community 36.0.2. It does not reproduce an entire business application. There are no enterprise modules, network-backed data, private source files, real records, commercial license keys, or authentication.

## Three primary pages

| Page | Field content | Data row/cell containers |
| --- | --- | --- |
| A /react/ | React components | AG Grid React |
| B /dom-cells/ | DOM components | AG Grid React |
| C /dom-rows/ | Same DOM components as B | AG Grid Community native components |

All modes use the same dependency graph and minimal build-time bridge. A/B must not enter its native path. The bridge only exposes the upstream native RowComp and mounts/reuses/destroys those components in the existing React row container. No frame slicing, extra lookahead, directional row buffers, skeletons, deferred renderers, or pointer suppression are added. Default upstream scheduling remains intact. The bridge is experimental and depends on AG Grid internals.

The React baseline uses stable data, column definitions and callbacks. It contains no busy waits, artificial CPU work, forced layout reads, or intentionally broken memoization. Equivalent cell content comes from a shared semantic view description: React creates elements; the DOM renderer serializes escaped HTML and parses it with a template/innerHTML. Both pay the same semantic view construction cost; differences in construction strategy are part of the measured implementations, not a pure isolated React tax. AG Grid's internal DOM differences are the independent variable for B/C.

## Fixed fixtures and workloads

- Seed: 16692. Standard: 500 rows × 60 columns. Stress: 5000 rows × 50 columns.
- Fixed 40 px row height, 5-row buffer, 150 px column width, row and column virtualization enabled. Desktop benchmark viewport: 1440 × 1000 CSS px, DPR 1.
- Mixed rich fields, rating, attachments, tags and plain text presets. Rich fields must be in the visible viewport; total column count alone is not rendering pressure.
- All assets are inline/local and ready before warmup. No external fonts or images affect timing.
- Same gestures, starting offsets, pointer position over grid body and completed scroll distances in all modes. Content updates, sorting and remounts are tested separately, outside timing.
- Browser input uses CDP mouse-source scroll gestures, never synthetic DOM WheelEvent or scrollTop loops as performance evidence.
- Read: 1200 px/s; wheel: 3600 px/s; fling: 9000 px/s; fling-stop: 9000 px/s then a stationary hold; horizontal scroll tested separately.

## Measurement and interpretation

Use a production build. Record browser version, OS/CPU, viewport, DPR, dependency versions, bridge hash, source revision, fixture and exact command with every result. 1× and 4× are primary conditions; 6× is exploratory CPU-throttling simulation, not proof of real low-end hardware behavior.

Warm up once after loading each mode in each CPU/block, then reset and wait before every gesture. Five repetitions per primary condition, with balanced A/B/C ordering (rotated/reversed across blocks). The main matrix is standard rich × five gestures × 1×/4× × five paired blocks. 6× has three exploratory blocks. Report each run, median, spread and paired per-block differences; differences within run-to-run variation are inconclusive. Do not pool historic measurements from other projects into these results.

The input named `fling` is a controlled 9000 px/s mouse-source gesture with `preventFling:true`, not hardware inertial scrolling. Timing ends immediately after its CDP acknowledgement and before position/geometry reads. `fling-stop` records its subsequent 750 ms hold separately. Visual sampling separates before, command-active and after windows; first-complete observations after acknowledgement are response-time upper bounds, and an already-complete first sample is left-censored.

The lightweight timing run records requestAnimationFrame callback intervals and long tasks. These intervals are a main-thread responsiveness proxy, not displayed FPS or actual dropped frames. Calibrate the idle rAF interval. Report p50/p95/max, intervals > 2× idle interval, and long-task count/total/max. Reproduction criterion: in a predeclared 4× rich-field condition, baseline has repeated callback gaps > 2× idle interval, or independently verified visible-content lag/blanking. Smoothness improvement is evaluated comparatively, not inferred from reaching an arbitrary score.

Separate visual diagnostic runs record sampled compositor screenshots and correct-content coverage/settling after the gesture. Screenshot frames are samples, not a complete record of display frames. Calibrate blank/content detection with known empty, correct, stale and sparse-content cases; manually inspect flagged examples. A skeleton or wrong text does not count as complete content. Trace collection is a separate diagnostic and never mixed with untraced timing results.

## Iterations and acceptance

1. Protocol and independent project skeleton: critical review of experiment boundaries and public-safe contents.
2. React baseline: critical review of rich fixture fidelity, functional page and actual reproduction evidence.
3. DOM content page: equivalent content, refresh/lifecycle and A/B checks; critical review.
4. Native row/cell page: route verification, parity, complete controlled measurements; critical review.
5. GitHub Pages deployment: direct navigation to all three pages, published build verification, raw results, report and final independent review.

Score weights: causal control/equivalence 30%, reproducibility 25%, measurement/conclusion credibility 20%, representative scenario 15%, complete delivery 10%. Aim for 10/10; finish only at ≥8.5 with no critical defect. A plan score never transfers to the delivered site.

Critical defects include misleading performance labels, mismatched content or input workload, unverified render paths, hidden optimization differences, missing raw evidence, publishing private materials, or claiming improvements contradicted by the results. Existing performance budgets are context, not transferable acceptance claims.
