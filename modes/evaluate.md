# Mode: Goods Radar A-G Evaluation

Codex evaluates each candidate under the shared rules and buyer profile. Output JSON only.

## Required Output Shape

Return an array. Each item must contain:

`source_id`, `score`, `omasum_level`, `evidence_level`, `development_distance`, `route_feasibility`, `risk_flags`, `status`, `next_action`, `rationale`, `citations`, `report_markdown`

## A-G Report

`report_markdown` must contain these sections:

1. `A) Supplier Identity` - what the source is, and what is known.
2. `B) Omasum Signal` - precise/broad product fit and uncertainty.
3. `C) Underdeveloped Potential` - why this may or may not be a hidden source.
4. `D) Route Feasibility` - public route signals only, clearly separated from supplier proof.
5. `E) Evidence Chain` - what evidence exists and what is missing.
6. `F) Risks` - concrete risk flags, not generic caution.
7. `G) Next Verification Action` - one operational next step.

## Scoring Guidance

- Score 0-100.
- Keep high scores for candidates with both plausible source access and clear next verification leverage.
- A strong public route can raise route confidence but not evidence.
- `D1` is mature reference, not the main discovery prize.
- `D2/D3` with `O3+` and verifiable next action is often the best discovery target.

## Citation Rules

Use only provided source URLs, route URLs, evidence IDs, or paths. If a fact has no citation in the case payload, phrase it as an uncertainty or next question.
