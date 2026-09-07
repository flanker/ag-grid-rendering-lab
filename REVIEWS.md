# Critical review log

Scores are stage-specific. A plan score is not a website or performance acceptance score. Reviews were performed by a separate critical agent; findings were addressed by the implementing agent.

| Iteration | Score | Findings and response |
| --- | --- | --- |
| Protocol | 8.8 / 10 | Fixed A/B/C variable boundaries, public synthetic implementation, Community-only scope, 1×/4× primary and 6× exploratory conditions. |
| A baseline, first review | 8.3 / 10 | Found PRNG low-bit periodicity, incomplete fixture hash and static sample label. Corrected all three; old run retained as a preliminary observation. |
| A baseline, revised | 8.8 / 10 | Verified diverse categorical values, full fixture identity, test-only API, correct long-task support labels and actual input displacement. |
| B DOM content | 8.7 / 10 | Shared semantic tree and normalized DOM/style parity; clarified HTML parsing versus React element construction. |
| C native row/cell, first review | 8.3 / 10 | Bridge scope correct. Requested full visible coverage and same-page lifecycle evidence rather than only intersection comparisons or page reloads. Added independent coverage and create/destroy accounting with three same-page remounts. |
| C native row/cell, revised | 8.8 / 10 | Verified complete visible identity/parent/content checks and same-page lifecycle: created minus destroyed equals live row count after all three remounts. |
| Measurement method, first review | 8.0 / 10 | Found geometry reads inside timing, hold time mixed into scroll p95, early observation timestamps and mixed visual windows. Separated all windows, added displacement assertions, response-time upper bounds, visual calibration edge cases and paired differences. |
| Measurement method, revised | 8.8 / 10 | Timing boundaries, paired blocks, actual displacement, calibrated visual cases and conservative content-observation timestamps verified; approved for frozen-build measurement. |
| Publication process, first review | 8.0 / 10 | Row-count-only report checks could pass with missing data. Requested online acceptance/evidence identity, complete unique matrices, raw-to-summary recomputation, frozen functional-check attribution and removal of obsolete generated deployment files. |
| Publication process, revised | 8.8 / 10 | All requested guards implemented: exact condition matrices, input/config checks, recomputed summaries, SHA-256 evidence manifests, actual displayed values and loaded images. Dedicated temporary gh-pages checkout replaces tracked generated output, preserving recoverable Git history. |
| Frozen measurement output | 8.9 / 10 | Reviewed 150 primary observations, 45 exploratory observations, nine visual diagnostics, seven calibration cases and 48 functional assertions. Independently viewed normal, blank and recovered images. Approved the conservative conclusion: CPU-pressure failure reproduced; B not consistently better; C sometimes better than B, not consistently better than A, and blanks remain. |
| Final GitHub Pages acceptance | 9.0 / 10 | Independent reviewer confirmed three experiment pages and report return HTTP 200, 48 deployed functional assertions and correct render paths, reload/navigation/manual capture/export, displayed report values and loaded images, six evidence hashes and matching frozen renderer source. No new required fixes. Accepted after synchronizing this final record; renderer build remains 2f1cda4. |

Final acceptance passed on 2026-09-07. Scores assess experiment and delivery quality, not a claim that all rendering problems are solved. The live evidence preserves its pre-final-review acceptance snapshot; the final record is published separately in `public/results/acceptance.json`.
