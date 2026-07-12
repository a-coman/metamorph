# Qualitative Validation Analysis

This report reviews the 25 validation sessions (100 exploration attempts: five domains × five generations × four transform families). An attempt is described as **compiled** when exploration produced an approved deterministic playbook, and as **executed** when the initial paired `source`/`follow_up` run completed and yielded observations. Replay comments refer only to the stratified 35-MR replay sample; a relation not mentioned as replayed was not included in that sample.

The evidence combines the exported metrics and manifests with the stored MR definitions, compiled steps, observation payloads, run errors, exploration checkpoints, and selected screenshots. A strict failure is not treated automatically as a website defect: the analysis distinguishes a meaningful relation violation from a bad MR, an unsuitable observable, an extraction problem, or an execution failure.

## 82ece300-e5c9-4b32-9b2d-9cd9fb95944f — Amazon, generation 1

- **Idempotence — compiled and executed; strict pass.** Re-submitting `laptop` preserved the query, `/s` path, result-count label, and query echo, so the MR is plausible and useful. However, `first_result_title` was empty in both phases, making the content-fingerprint part of the pass vacuous.
- **Subset — not compiled.** Exploration stopped after filling the search box because the planner incorrectly concluded that submission was unavailable, even though its own rationale identified the search field and submit button. This is a planning/termination error rather than a website limitation.
- **Permutation — not compiled.** A navigation destroyed the page context during probing, so no validated two-filter path was produced.
- **Inverse — compiled and executed; strict fail, replay stable.** Removing the brand refinement correctly changed the filter parameter, chip presence, and result count while preserving the query and Amazon chrome. The only failing item was an empty results-section heading after removal; the stable failure therefore reflects a brittle ancillary text observable, not evidence that filter removal was incorrect.

## 651e6dad-6dbb-47a1-8915-7819a63ab37a — Amazon, generation 2

- **Idempotence — compiled and executed; strict pass, replay stable.** Query, route, result summary, sort, and department were identical in all three runs. The product-title fingerprint was an empty list throughout, so replayability is strong for page-level state but unproven for listing content.
- **Subset — not compiled.** The planner treated dismissing cookies and entering a query as an impossible single action, despite recognizing that the goal could be split across batches. This was a premature abort caused by plan-state reasoning.
- **Permutation — not compiled.** Exploration selected an off-screen “skip to results” link instead of the intended filter; overlapping result-page elements repeatedly intercepted the click.
- **Inverse — compiled and executed; strict pass.** Returning from results to the homepage cleared the query and removed results-specific state while preserving header chrome. The MR and observables are appropriate, although this MR was not in the replay sample.

## 2c12ab50-ff16-431e-8eeb-58af504c3953 — Amazon, generation 3

- **Idempotence — compiled and executed; strict pass.** Query, path, result summary, sort, and URL parameter were stable. Empty product-title fields again weaken the claim that the actual listing was unchanged.
- **Subset — compiled and executed; strict pass.** The query and route were preserved and the parsed total fell from more than 20,000 to about 4,000 after refinement. This is a semantically correct and useful subset test, though the site exposes rounded rather than exact cardinalities.
- **Permutation — compiled but initial execution failed; replay class `execute_failure`.** The MR sensibly compares two independent refinements through URL refinement state, active chips, and product identities. Two of the three executions failed before observations and the remaining replay produced a strict failure, so the compiled path was not reliably replayable.
- **Inverse — compiled but execution failed.** The proposed remove-filter relation is useful, but the compiled source and follow-up used different autocomplete-expanded queries. The paired paths therefore did not reliably rebuild the same base state, and the stored run only reports a generic browser-test failure.

## 363d4097-b1ab-4b51-8ad4-478342504cd1 — Amazon, generation 4

- **Idempotence — compiled and executed; strict pass.** Query, path, URL query, and result label were identical, but all three sampled product-title observables were empty. The verdict is credible for navigation/query state and weak for result content.
- **Subset — compiled and executed; strict fail, replay `execute_failure`.** The central subset evidence was correct: the count decreased from roughly 20,000 to 50 and the query remained stable. The strict failure came from a missing sort label, which is incidental to subset semantics. Replays then failed because the count could not be extracted in one run and the page flow failed in the other, demonstrating both oracle overconstraint and extraction fragility.
- **Permutation — compiled and executed; strict fail with observation drift.** The observed price bounds differed by order in the initial run, matched in one replay, and were missing in another; product-title sets were always empty. This can expose an order-dependent filter application, but the drifting bounds and absent content evidence make the verdict unstable and prevent attributing the failure to Amazon itself.
- **Inverse — compiled and executed; strict pass.** Clearing the query returned to `/ref=nav_logo`, not the stated homepage pathname `/`. Because the oracle only required the path to differ from `/s`, it accepted a weaker condition than the MR description. This is a false-negative risk: navigation was broadly undone, but exact restoration was not tested.

## ad113544-897a-4596-9cb2-b94b87531fc5 — Amazon, generation 5

- **Idempotence — compiled and executed; strict pass, replay stable.** Query, count label, sort, route, and `k` parameter were identical across all runs. The product fingerprint remained empty, so the result is strong for control state but incomplete for listing identity.
- **Subset — compiled and executed; strict pass, replay stable.** The query stayed fixed and the rounded total decreased from more than 20,000 to about 3,000. This is a useful and replayable MR with an appropriate cardinality oracle.
- **Permutation — not compiled.** Autocomplete changed the base query and the filter state became internally inconsistent: a remove-filter control was present while no selected checkbox was identifiable. Aborting was appropriate because the two equivalent final states could no longer be established.
- **Inverse — compiled and executed; strict pass, replay stable.** Returning to the homepage consistently cleared the input, count, and query echo while retaining persistent header controls. This is a strong replayable inverse example.

## 10b0558c-33c9-41e1-ac31-86902e7c22f2 — Airbnb, generation 1

- **Idempotence — compiled and executed; strict pass.** The chosen observables were promotional-modal texts and visibility flags, all empty/false in both phases. They do not measure the stated destination, result count, URL, or listings, so the pass is vacuous and the observable selection is inadequate.
- **Subset — compiled and executed; strict fail.** Destination, dates, route, reported “more than 1,000” count, and filter UI were preserved, but the guest label changed from one traveler to “add travelers.” The strict verdict correctly identifies that the paired queries were not equivalent; this is a path-reconstruction problem, not a demonstrated violation of subset semantics.
- **Permutation — compiled and executed; strict fail with observation drift.** Screenshots show that “Playas” and “Ciudades” are mutually exclusive tabs: the last click determines the final category, so reversing their order should produce different states. The MR is therefore semantically invalid. Dynamic destination recommendations also changed between replays, explaining the drift; the strict failure is useful as rejection of a bad MR, not as a website fault.
- **Inverse — compiled and executed; strict fail with observation drift.** Switching to a category and back is a plausible inverse, and the route/search chrome remained stable. Failure was caused by a missing page heading in one phase, while the recommendation grid itself changed across runs because it is dynamic. The oracle overweights volatile content and extraction timing.

## 3418dfdf-4c89-4b2c-ae0c-17cfddeaa43b — Airbnb, generation 2

- **Idempotence — compiled and executed; strict pass, replay stable.** Only the pathname and empty promotional-modal fields were observed. The route was reproducible, but the observables omit destination, count, and listing content, so the stable pass is substantially vacuous.
- **Subset — compiled but execution failed.** The relation is plausible, but the observable set contains only URL fragments and omits the promised result cardinality and visible filter state. Even if execution had completed, it would not have adequately evaluated the subset property.
- **Permutation — not compiled.** The expected “Filters” control was absent under the validated locator, preventing construction of the two-filter path.
- **Inverse — compiled, but the initial run and both replays failed.** Switching from Experiences back to Stays is semantically appropriate, and persistent header controls were reasonable observables. No evaluable pair was produced; the stored evidence only identifies a browser-test failure, so a more specific cause cannot be supported.

## ea0dc79e-2562-4bdf-8faa-12647e93e63d — Airbnb, generation 3

- **Idempotence — not compiled.** The destination control found during exploration was no longer uniquely available when the validated step was replayed.
- **Subset — compiled and executed; strict pass, replay `execute_failure`.** Destination, dates, and route were stable, but the coarse count remained “more than 1,000” and the same `Wifi` label appeared in both phases. These values do not demonstrate that narrowing occurred. One replay failed while another passed, so the path is only partially replayable and the passing oracle is weak.
- **Permutation — not compiled.** The date picker and cookie banner left the page in a contradictory blocked state, preventing a reliable search and two-filter sequence.
- **Inverse — compiled but execution failed.** The intended apply/remove-filter relation is useful, but the selected observables focused on a modal title and close button rather than URL restoration, selected filters, counts, or listings. The MR was therefore not evaluable even before considering the browser-test failure.

## 21c534ac-b142-4017-b502-d4b308214649 — Airbnb, generation 4

- **Idempotence — compiled and executed; strict pass, replay `execute_failure`.** Initial destination, count, route, and prices matched; listing titles were an empty list. Both replays failed at the page-flow level, so a good initial verdict did not translate into replayability.
- **Subset — compiled and executed; strict pass, replay stable.** Query fields and route were stable in all runs. The reported count stayed at the coarse “more than 1,000” threshold and filter presence was true in both phases, so the test is replayable but provides weak evidence that the result set actually narrowed.
- **Permutation — compiled, but the initial run and sampled replays failed.** The independent-filter relation and URL/active-filter observables are sensible in principle, but no complete pair was obtained.
- **Inverse — compiled and executed; strict pass.** The goal was to clear `Madrid`, but the follow-up input became `Alicante`. A `not_equal` comparison accepted any changed value rather than requiring an empty value. This is a clear false pass caused by an under-specified inverse oracle.

## 10602e54-a358-44a9-b9b4-bcfe721abaa5 — Airbnb, generation 5

- **Idempotence — compiled but execution failed.** Destination, route, count, dates, guests, listing titles, and prices would have formed an appropriate observable set, but no paired observations were produced. The stored error is only a generic browser-test failure.
- **Subset — not compiled.** The LLM plan omitted the required follow-up goal and failed schema validation before exploration.
- **Permutation — not compiled.** The expected Filters button could not be resolved on the live results page.
- **Inverse — not compiled.** The destination control used in the planned undo path was unavailable under the validated locator.

## a0918e0a-84d5-4f71-872c-03604766e4c4 — Booking, generation 1

- **Idempotence — not compiled.** Exploration exhausted the 30-iteration budget without validating a complete repeated-search path.
- **Subset — not compiled.** Smoke replay could not find the previously observed cookie-decline control, showing overlay-state instability between discovery and validation.
- **Permutation — not compiled.** The cookie-accept control was similarly unavailable when replayed.
- **Inverse — not compiled.** The same cookie-overlay locator instability prevented validation of the undo path.

## a3edf751-08a9-4d88-bbc3-29970e3362c2 — Booking, generation 2

- **Idempotence — not compiled.** A sign-in information modal remained visually present while the page body intercepted clicks on its dismiss control, so the repeated-search path could not begin.
- **Subset — not compiled.** The same modal-interception problem prevented the search UI and a filtered results state from being reached reliably.
- **Permutation — not compiled.** The planner prematurely described the dismissible cookie overlay as an obstacle to reaching filters and never established the results-page two-filter scenario.
- **Inverse — not compiled.** The sign-in modal again blocked reliable access to the search UI and undo path.
- **Session interpretation.** Zero of four attempts compiled despite 78 LLM calls. The dominant limitation was overlay interaction, not the semantic availability of potential MRs.

## 1c0480a3-46a9-46cd-b508-53bca53f4513 — Booking, generation 3

- **Idempotence — compiled and executed; strict fail, replay stable.** Destination, route, guest configuration, first-hotel price, rating, and stay label matched. Only the date fields differed: placeholders were extracted in the source and selected dates in the follow-up. The stable failure is a deterministic binding/timing problem, not evidence that repeating the search changed the results.
- **Subset — not compiled.** Navigation invalidated the page context before a stable filtered state could be captured.
- **Permutation — not compiled.** The same navigation/context loss prevented validation of two filters in opposite orders.
- **Inverse — not compiled.** The attempt remained in `exploring` with no recorded failure reason. This is an evidence/instrumentation gap and should not be assigned a speculative cause.
- **Session interpretation.** This was the most expensive session (202 calls and about 3,743 seconds of accumulated LLM latency) yet produced only one compiled MR, showing that additional exploration effort did not overcome the page-state instability.

## 5cb64ef7-07b1-43be-8bdc-12e4cdc546ba — Booking, generation 4

- **Idempotence — not compiled.** The attempt selected July 10 after it had become disabled/past relative to the live page, so the calendar control never became actionable.
- **Subset — not compiled.** It reused the same disabled date and likewise could not reach a stable filtered results page.
- **Permutation — not compiled.** Several different filters unexpectedly navigated back to the homepage and discarded the Paris query; after repeated equivalent failures, exploration correctly aborted.
- **Inverse — not compiled.** Exploration reached the 30-iteration limit without validating the undo sequence.
- **Session interpretation.** Zero MRs compiled despite 127 calls. Hard-coded live dates and unstable filter links were the main environmental threats.

## a0370cf7-125d-41b0-9703-02b7d82be595 — Booking, generation 5

- **Idempotence — compiled and executed; strict fail, replay stable.** Exploration checkpoints and screenshots show a correct Paris results state and a successful second Search click. The compiled source path, however, omitted its Search click, so execution compared a populated homepage with a results page. The strict verdict correctly rejected the non-equivalent pair, but the cause is loss of a validated step during compilation rather than a failed Booking idempotence relation.
- **Subset — not compiled.** Navigation destroyed the page context before the filtered results state could be validated.
- **Permutation — not compiled.** A persistent Genius modal and open calendar prevented reliable access to the search and filter controls.
- **Inverse — compiled and executed; initial strict fail, replay observation drift.** The initial run navigated to `/city/fr/paris.html` while the two replays stayed on `/` and passed after clearing the input. This is a timing/autocomplete race: the same deterministic steps sometimes select/navigate before the clear action. The relation is plausible, but replay inconsistency makes the result unreliable.

## 78327d09-a6c3-4742-9fb6-0e430025d6c9 — GitHub, generation 1

- **Idempotence — compiled but execution failed.** Query, route, type, count, sort, and repository fingerprint were well chosen, but no evaluable pair was produced; only a generic browser-test failure is recorded.
- **Subset — compiled and executed; strict fail.** The visible count decreased after adding `language:JavaScript`, but the oracle required the full `q` parameter to remain byte-identical. Because GitHub encodes the added qualifier inside `q`, the expected transformation itself caused failure. The count parser also reduced values such as millions to their leading number. This is a false positive from incorrect observable normalization.
- **Permutation — compiled and executed; strict fail.** Final URL, language, result count, and result type matched; failure came from a missing sort label and one absent repository in an exact first-page set. The relation is plausible, but ranking/content fingerprints and text binding are too brittle for a strict equality oracle.
- **Inverse — compiled and executed; strict fail, replay stable.** Search-to-home navigation was undone correctly, but homepage and results layouts exposed different navigation/sign-in elements. Requiring this responsive chrome to be identical caused a stable false positive.

## 7004308f-cb46-41d9-8d9c-7389d381cb0d — GitHub, generation 2

- **Idempotence — compiled and executed; strict fail, replay stable.** Query, path, count, first repository, and active type were identical; only the sort text was missing after re-submit. The stable failure is an extraction issue in an otherwise strong idempotence test.
- **Subset — compiled and executed; strict fail, replay stable.** The oracle again treated the qualifier-bearing `q` value as an invariant and parsed `7.1M` and the filtered count without compatible units. A missing sort label added another irrelevant failure. Stable replay confirms a consistently mis-specified oracle rather than website flakiness.
- **Permutation — compiled and executed; strict pass, replay stable.** Both orders converged to the same URL parameters, query, count, type, and repository set; screenshots confirm the JavaScript repository result state. This is the strongest permutation example, although Repositories was already the default active type, which reduces how independently the first filter was exercised.
- **Inverse — not compiled.** The open Platform dropdown could not be closed through Escape or its trigger, so the undo state was not validated.

## 61c3db36-9c41-47d0-a324-41c8a3ec7657 — GitHub, generation 3

- **Idempotence — compiled and executed; strict fail.** All substantive search and repository values matched; only the sort label was missing in the follow-up. This is another false positive caused by the same fragile auxiliary observable.
- **Subset — compiled and executed; strict fail.** Adding `language:Python` produced the expected narrower view, but the full query parameter was incorrectly required to be equal, the count lost its magnitude suffix, and the Languages sidebar was required to remain visible even though the selected-filter UI legitimately changed. The strict verdict rejects the oracle design, not a subset violation.
- **Permutation — not compiled.** The generated plan omitted the observables array and failed validation.
- **Inverse — not compiled.** The model returned empty content before a plan could be validated.

## 5ca7e976-75bb-4809-9f32-10d049ce560c — GitHub, generation 4

- **Idempotence — compiled and executed; strict pass.** Query, path, type, count, repository filter, and six top repositories matched. The MR is both semantically sound and supported by non-empty content observables, though it was not selected for replay.
- **Subset — compiled and executed; strict fail.** The central evidence supports the MR: the reported count fell from 131 to 44. Failure was caused by treating the changed qualifier URL, search-field aria text, and repository-tab count as invariants, even though each should change under filtering. This is a clear false positive from overconstraint.
- **Permutation — compiled, but the initial run and both replays failed.** The relation and observables were sensible, yet the two-filter path never produced a complete pair, so replayability is absent.
- **Inverse — not compiled.** Typing into the planned typeahead immediately submitted a search, so the dropdown state required for the inverse never existed.

## 8c1c3083-4aab-4cd3-bc81-952170679543 — GitHub, generation 5

- **Idempotence — compiled and executed; strict pass, replay stable.** Query, path, active type, count, and first result remained identical across all runs. This is a strong, non-vacuous idempotence result.
- **Subset — compiled and executed; strict fail, replay stable.** The count decreased after the JavaScript restriction, but the same invalid equalities on the qualifier-bearing query and changing language-filter list caused failure. Stable execution makes the bad-oracle diagnosis especially clear.
- **Permutation — not compiled.** Exploration declared the scenario complete but returned no final steps, so validation rejected the empty step sequence.
- **Inverse — compiled and executed; strict pass, replay stable.** Opening and then closing the Solutions dropdown consistently changed only dropdown visibility while preserving URL, search, and header controls. This is a clean and replayable inverse MR.

## f0a78df6-4924-40c1-83a8-b8dbc8b72d10 — MediaMarkt, generation 1

- **Idempotence — compiled and executed; strict fail.** Source and follow-up did not represent the same query state: autocomplete/redirect behavior expanded the query and moved from the homepage path to the iPhone brand page. The verdict meaningfully detects a non-equivalent pair, but this is a compiled-path/autocomplete problem rather than evidence that identical submissions are non-idempotent.
- **Subset — compiled and executed; strict fail.** Cardinality correctly fell from 128 to 17 and the category remained stable. Failure came from an empty follow-up search input and from requiring the entire filter sidebar text to remain equal even though facet counts and options should change after filtering. The core MR holds; the oracle is overconstrained.
- **Permutation — not compiled.** Exploration exhausted the iteration budget without validating two independent filters in both orders.
- **Inverse — compiled and executed; strict fail.** Removing HP correctly removed the URL parameter and chip and expanded the count from 457 to 2,043. The oracle nevertheless required those transformation-specific values to remain equal. The strict fail correctly exposes a logically inverted oracle, not a MediaMarkt defect.

## 93d8d6a4-442b-4062-87eb-9d2e4648ae2b — MediaMarkt, generation 2

- **Idempotence — compiled and executed; strict fail with observation drift.** Exploration evidence already records autocomplete changing `iphone` to `iphone 17 pro max`. Runs consistently compared different route/query states, while category and campaign lists also loaded differently across replays. The failure is meaningful as a path-equivalence failure; drift comes from asynchronously populated lists, not verdict instability about a valid identical query.
- **Subset — compiled but all sampled executions failed.** The required numeric result count was `null` in source observations, so schema validation rejected the payload before relation evaluation. Reliance on one brittle count label made the test non-replayable.
- **Permutation — compiled but the initial run and both replays failed.** The two-filter relation is useful and the proposed URL/chip/count/product observables are appropriate, but no evaluable pair was produced.
- **Inverse — compiled and executed; strict fail.** The filter-specific controls cleared and the result count expanded, but autocomplete changed `auriculares` to `auriculares inalambricos`. The verdict usefully identifies that the base query was not preserved; the unchanged false chip-presence value also shows imperfect extraction.

## 467aba61-9311-42d8-bcac-bbe4b3de2713 — MediaMarkt, generation 3

- **Idempotence — compiled and executed; strict pass.** Query, route, count, URL parameter, and two product names/prices were all non-empty and identical. This is the strongest MediaMarkt idempotence example.
- **Subset — compiled but execution failed.** The total count could not be parsed and was `null`, so the pair was rejected before evaluation. The remaining page/filter observables could not compensate for the mandatory brittle cardinality field.
- **Permutation — not compiled.** After earlier refinements, the required CECOTEC brand disappeared from the result set, so the same combined filter state could not be constructed in reverse order.
- **Inverse — compiled and executed; strict fail with observation drift.** Removing HP correctly cleared the URL and chips and expanded the live count. The oracle wrongly required chips and count to equal the filtered source; live totals also drifted from 465/2,203 to 467/2,205 across replays. The verdict is consistently a bad-oracle failure, while hash drift reflects genuine catalogue volatility.

## f00a8601-92b4-4c45-baac-b85302337e64 — MediaMarkt, generation 4

- **Idempotence — not compiled.** The model returned empty content before producing a valid exploration plan.
- **Subset — compiled but execution failed.** The result-count extractor returned `null`, preventing schema-valid source observations. The relation is plausible, but the selected cardinality binding was not robust enough for execution.
- **Permutation — not compiled.** The model again returned empty content before exploration.
- **Inverse — compiled and executed; strict pass.** Clearing the television search returned to `/es/`, emptied the input, removed results/filter state, and preserved main navigation. This is a semantically correct and useful inverse test.

## 9dbed16e-317f-40b7-9c7c-b104c06cd533 — MediaMarkt, generation 5

- **Idempotence — compiled and executed; strict fail, replay `execute_failure`.** Page, count, product, and price matched; only capitalization changed from `iPhone 15` to `iphone 15`. Exact string equality makes this an overly strict false positive. One replay failed count extraction while another passed, confirming sensitivity to representation and loading rather than a substantive relation violation.
- **Subset — compiled but the initial run and both replays failed.** The required total count was always `null`; the test never reached relation evaluation.
- **Permutation — compiled but the initial run and both replays failed.** The intended brand-plus-price commutativity relation is useful, but the deterministic filter sequence did not yield any complete pair.
- **Inverse — compiled and executed; strict fail with observation drift.** Search input and route were broadly undone, but the oracle required an empty result label to become different, expected breadcrumb presence to stay equal, and depended on a homepage campaign heading that loaded inconsistently. Replays stayed on the homepage with differing source query text. The strict failures are driven by wrong comparison directions and asynchronous content, not a meaningful inverse violation.

# Cross-session qualitative findings

## RQ1 — Feasibility of exploration, compilation, and evaluable paired runs

Metamorph compiled 63 of 100 attempts and completed 48 initial paired executions. The qualitative evidence confirms that successful compilation often produced semantically recognizable MRs, especially repeated searches, count-reducing filters, filter removal, and open/close navigation actions. The strongest examples are Amazon generation 5 subset/inverse, GitHub generation 2 permutation and generation 5 idempotence/inverse, and MediaMarkt generation 3 idempotence.

Compilation success is nevertheless not equivalent to a semantically complete executable test. Booking generation 5 lost the source Search action despite screenshots proving that exploration had validated it. Several passes compared empty product lists or empty modal fields. Conversely, 15 of the 63 compiled MRs failed their initial execution, commonly because a required result-count label was absent, a live locator no longer matched, or the compiled flow rebuilt a different autocomplete state.

The 37 pre-compilation failures cluster around live-page state rather than MR theory: overlays and intercepted clicks (especially Booking), navigation invalidating the current page context, stale or non-unique controls, autocomplete/filter-state changes, exhausted iteration budgets, and six clear LLM/schema-output failures (missing fields/steps or empty content). Booking is the limiting domain: only 3 of 20 attempts compiled, and high LLM effort did not overcome its modal, calendar, and navigation instability. Permutation was also structurally hardest because it requires two genuinely independent controls to remain available in both orders.

## RQ2 — Replayability without further LLM inference

Among the 35 MRs selected for replay, 16 were stable, 7 had observation drift, and 12 had at least one execution failure. Stable results were most common on GitHub (7 of 8 sampled) and absent on MediaMarkt (0 of 8). This supports deterministic replay on comparatively stable, URL-addressable interfaces, but not uniformly across dynamic commerce/travel sites.

Observation drift has three distinct meanings:

1. **Dynamic content drift:** Airbnb destination recommendations and MediaMarkt catalogue counts changed while the strict verdict stayed failed.
2. **Asynchronous extraction drift:** MediaMarkt category/campaign lists appeared as full, partial, or empty; some Amazon price bounds were present in one run and absent in another.
3. **Path-state drift:** Booking's clear-destination inverse navigated to the Paris page initially but stayed on the homepage in both replays; Amazon's permutation alternated between matching and different price states.

The absence of a `verdict_drift` classification does not mean all strict verdicts were identical: cases where both payloads and verdicts changed are classified as observation drift. Execution failures were dominated by unresolved live interactions and invalid mandatory numeric observations. The stored browser-test error is generic for several runs, which limits more precise causal attribution and should be acknowledged as an evidence limitation.

## RQ3 — MR, observable, and strict-verdict quality

The main quality problem is not the high strict-fail rate by itself, but a mismatch between relation semantics and compiled comparisons:

- **Expected transformation encoded as equality.** GitHub subset tests required the full `q` parameter to remain equal even though language filters are encoded inside it. MediaMarkt inverse tests required filter chips and result counts to remain equal after filter removal.
- **Under-specified inverse conditions.** Airbnb generation 4 passed when `Madrid` became `Alicante` because `not_equal` was accepted instead of requiring an empty input. Amazon generation 4 accepted any non-results pathname rather than the stated homepage path.
- **Vacuous equality.** Empty product-title arrays, empty headings, and absent modal content frequently matched and produced strict passes without supporting the intended property.
- **Overly brittle auxiliary observables.** Missing sort labels, responsive header chrome, full sidebar text, recommendation grids, and exact first-page rankings converted otherwise valid relations into strict failures.
- **Unnormalized numeric/text values.** GitHub magnitude suffixes and MediaMarkt capitalization/count-label loading produced misleading failures or invalid payloads.

The strict verdict is therefore effective as a conservative detector of any compiled inconsistency, but not as a direct website-fault oracle. It correctly exposed non-equivalent paths, bad MRs, and lost steps; it also produced false positives from irrelevant equalities and false negatives from weak `not_equal` checks. The most defensible interpretation for the thesis is that strict failures are **triage triggers**. Meaningful violations require confirming that the transformation was actually applied, the source and follow-up share the intended base state, observables directly represent the relation, and extraction returned non-empty normalized values.

Overall, the study supports all three RQs with qualifications: LLM-assisted exploration can discover and compile useful MRs on real sites; deterministic replay works well for some domains and interaction families but is sensitive to live UI state and data drift; and generated test quality is mixed, with many plausible relations but observable/oracle design remaining the primary source of misleading verdicts.
