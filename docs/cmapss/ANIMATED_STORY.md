# Automatic case-study walkthrough (v0.5)

Current v0.7 update: [computed comparisons and renewed viva review](VIVA_COMPARISON_REVIEW.md). Includes a cost/margin factorial, per-engine sensitivity, an executable equal-requirement JSON/RDF comparison, and cross-case synthesis. Earlier version notes below retain their historical scope.

The existing explorer now has **Play case study**, with a direct entry at `/cmapss/?story=1`. It opens an approximately three-minute, nine-scene walkthrough with English explanatory text and controls. It is a browser animation with a readable transcript, not a narrated video. The original explorer remains available and its selected dataset, cycle and policy are preserved when the story closes.

## Narrative and contributions

The story uses the preserved **FD001 / Engine 034** trajectory, independently of the explorer's current selection. This fixed identity is visible throughout. Four-subset endpoint coverage is introduced only at the conclusion to describe evaluation scope and limitations.

| Scene | Evidence / activity | What the viewer learns |
| --- | --- | --- |
| 1. Research question | Cycle 30 and declared asset/contract context | RUL alone does not specify service responsibility. |
| 2. Observe | Actual records, cycles 30–94 | The replay adapter fulfils data-acquisition responsibilities; observations retain asset and source context. |
| 3. Estimate | Exported causal predictions, cycles 94–158 | The DTE estimate, residual interval and baseline service state are distinct from action selection. |
| 4. Connect/query | Cycle 158; actual RDF, SHACL and SPARQL | Framework responsibilities are linked through typed objects, units and provenance. |
| 5. Broken evidence | Remove the cycle unit from a test copy | SHACL detects incomplete evidence; the original physical data and prediction have not changed. |
| 6. Contract costs | Fixed cycle 158 | Continue versus Enhanced Monitoring follows different assumed consequence costs, with neither intervention margin active. |
| 7. Intervention margin | Fixed cycle 171; actual contract query | A lower bound between 15 and 25 cycles makes the stricter policy recommend Planned Maintenance. The separate KPI budget still misses the assumed 99% target. |
| 8. Handoff | Cycle 181; actual baseline evidence query | The baseline also recommends maintenance. Recommendation remains proposed; authorization, execution and outcomes are absent. |
| 9. Contributions/limits | Implementation evidence and all-subset coverage | Explain implemented contributions and limits without treating the prototype as proof of novelty or measured service benefit. |

The persistent collaboration panel (alongside the evidence on wide screens, stacked below on smaller screens) maps five responsibility groups (OE/DCE/DTE/UE/CS) to asset, observation, estimate, contract/advice and provenance/validation concepts. Highlighting is a teaching device, not a network trace or an OWL inference visualization. The graph uses the actual relationship directions: observation → asset, window → observations, estimate → window, and recommendation → estimate, with model/source/contract/policy references stated alongside it.

Three **implementation-level contributions** are presented:

1. An executable mapping from servitization responsibilities to observation, prediction, policy and recommendation functions.
2. Cycle-valued semantic evidence with provenance, real SPARQL and SHACL Core checks.
3. Controlled contract comparisons that preserve technical evidence while explaining different advice.

Their practical relevance is reviewable maintenance planning and explanation of service responsibility. The case does not establish theoretical novelty, complete ISO compliance, actual availability, savings, downtime reduction or intervention effectiveness. Those claims need evidence beyond this degradation dataset and, for novelty, comparison with prior research. Full-test endpoint coverage remains visible (78.0%, 67.2%, 69.0%, 61.3%); semantic conformance is not predictive accuracy.

## Runtime behavior

- Nine scenes last approximately 174 seconds in total at 1×, plus semantic loading/execution time. Speeds: 0.5×, 1×, 2×.
- Sensor values and RUL frames are selected from existing exported records. No interpolation of prediction values, future truth or artificial damage is added. Playback is a time-compressed explanation, not live acquisition or in-browser model fitting.
- The semantic scenes execute the existing browser engine against fixed, explicit snapshots. A scene's automatic timer waits for its expected result. Unexpected results or fetch/execution failures pause the player and show a retry control; a successful retry does not silently resume playback.
- Pause/resume retains elapsed progress. Manual chapter/previous/next selection pauses. Restart clears this story session's check records. A hidden document pauses. Escape exits and removes the deep-link query parameter.
- Reduced-motion preferences disable decorative fan/packet animations and transitions; the explicit player controls remain usable. The transcript offers a static reading path.
- Export records dataset/model/source provenance, visited chapters, whether playback reached the end, and only semantic checks actually completed in this session, including RDF, query, report and SHA-256 hashes. A manual jump to the conclusion does not manufacture missing checks or claim every chapter was visited.

## Reproduction and validation

```sh
npm run test:cmapss:story
npm run build
DASHBOARD_URL=http://127.0.0.1:5179/wt-servitization-dashboard/ \
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
CHROME_EXECUTABLE=/path/to/chrome node scripts/verify-cmapss-story-ui.mjs
```

The pure player test covers progression, waiting, pause/restart, observed-only frames, known action comparisons and all four actual semantic outcomes. The browser test runs the complete automatic sequence, verifies exported evidence, then checks manual scenes, failure/retry, direct entry/exit, reduced motion and 390/320px layouts. Screenshots and the machine-readable result are under `screenshots/cmapss-story/`.

## Viva revision (v0.6)

The opening now distinguishes asset evidence, service context and unimplemented
service delivery. The semantic chapter walks through the actual implementation
order; validation inspects advice, rather than enforcing approval. Choose
**Viva · manual inspection** to pause progression and inspect examiner questions,
contribution boundaries and computed FD001 sensitivity. The complementary-case
cards distinguish WT process demonstration from C-MAPSS evidence-to-advice
validation. See [VIVA_REVISION.md](VIVA_REVISION.md) for methods, denominators and
outstanding research comparisons; no measured service benefit is asserted.
