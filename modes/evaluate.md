# Mode: Goods Radar P0 A-G Evaluation

Codex evaluates each candidate as a sourcing radar analyst. Return JSON only.

## Required JSON Fields

Return an array. Each item must include:

`source_id`, `score`, `omasum_level`, `evidence_level`, `development_distance`, `route_feasibility`, `p0_readiness`, `supplier_role`, `source_access_path`, `product_scope_questions`, `contact_questions`, `disqualifiers`, `why_now`, `risk_flags`, `status`, `next_action`, `rationale`, `citations`, `report_markdown`

Allowed `p0_readiness` values:

`outreach_ready`, `contact_needed`, `product_scope_needed`, `watchlist`, `reject`

Allowed `supplier_role` values:

`slaughterhouse`, `byproduct_processor`, `exporter`, `cold_storage`, `trader`, `unknown`

## A-G Report Contract

`report_markdown` must be concise Chinese Markdown with these sections:

1. `A) 身份与角色`: what the source is, what is known, and whether it is a slaughterhouse, processor, exporter, cold store, trader, or unknown.
2. `B) 为什么可能有 omasum`: precise and broad product clues, byproduct capability, bovine slaughter, export scope, or route context.
3. `C) 为什么可能尚未被充分开发`: negative-space analysis, radar facts, market whitespace, and why D1 evidence is absent.
4. `D) 公开触达路径`: company site, official directory, public contact page, or the missing-contact action.
5. `E) 缺失证据`: missing video, product scope, quote, QC, contact, route, transaction, or local verification facts.
6. `F) 风险与淘汰条件`: concrete risks and disqualifiers.
7. `G) 下一步 P0 动作`: one operational next action with five must-ask questions and required materials.

## Scoring Guidance

- Score range is 0-100.
- Favor candidates with official identity, high radar signal, source-side capability, and clear verification path.
- Penalize pure agents, unverifiable claims, vague product scope, mixed tripe risk, and missing source access.
- Strong route context can improve route confidence only.
- Strong radar context can improve priority and P0 readiness only.
- Mature D1 samples are calibration, not the main discovery target.
- O1/O2 plus high radar is often `product_scope_needed`, not automatic rejection.

## Citation Rules

Use only provided `url_or_file`, `source_url`, `evidence_id`, or `path_or_url`. If the payload does not include a citation for a fact, state it as uncertain or as a verification question.
