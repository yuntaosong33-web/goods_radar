# Source Audit Rules

Goods Radar cannot treat scraped text as supplier truth. Every assessment must separate discovery signals, capability signals, route signals, supplier evidence, and mature transaction references.

## Structured Sources Currently Usable

| Source | Status | Retrieval | Evidence |
| --- | --- | --- | --- |
| Paraguay SENACSA frigorificos | usable structured source | Official page -> public Google Sheets CSV | SENACSA registration + processor name + destination/product classes |
| Uruguay Meats exporters | usable structured source | Exporter cards | INAC card number + product detail URL + company title |
| Brazil Comex Stat | public route API connected | `/general` POST aggregate query | Brazil country/HS route signal only |
| Six-country capability radar | fixture/local structured source in v1 | `collect:radar` official-source parser and manual-required audit | factory capability, slaughter/capacity, export readiness, byproduct/cold-chain signals |

## Gated Or Background Sources

| Source | Status | Rule |
| --- | --- | --- |
| Brazil MAPA / DIPOA | entry point only unless structured query works | Do not score entry-page fragments as suppliers |
| Argentina SENASA / Chile SAG / Colombia INVIMA | official capability source, parser/manual export first | Capability signal only unless structured plant identity is present |
| GACC/CIFER / TRACES | interactive or manual export first | Approval signal only; do not create shipment or supplier facts |
| UN Comtrade | API key required | Route signal only; no supplier identity |
| WITS / FAOSTAT | background or cross-check | Do not upgrade supplier evidence |

## Optional Manual Or Paid Sources

| Source | Minimum proof before scoring upgrade |
| --- | --- |
| Bill-of-lading / customs exports | bill number or date, shipper, product description, destination, source file/URL |
| Google Maps / social / trade fairs | must be upgraded with official registration, media, phone verification, or local feedback |
| Local intelligence | contact, date, question list, media/GPS or clear conclusion |
| Internal experience | quote, trial, QA photo, deduction, repeat purchase, or buyer feedback |

## LLM Evaluation Guardrails

- Codex may reason about supplier potential, risk, hidden supply, negative space, and next actions.
- Codex may not invent evidence or create new business facts.
- Public route data can only affect `route_feasibility`.
- Capability radar data can only affect `radar_score`, `priority_grade`, and sourcing rationale.
- Node guardrails cap `evidence_level` and block `D1` when the evidence chain does not support it.
- Every Codex result must be auditable in `data/llm-evaluations.tsv` and, when provided, `reports/evaluations/*`.

## Verification Gate

`verify-pipeline.mjs` checks:

- auto-collected official rows have HTTP source URLs, registration, and structured parsing notes;
- trade route rows are `route_signal_only`;
- factory capability, slaughter capacity, export approval, radar score, and radar source health rows are parseable and traceable;
- bill rows are `E2` and `D1`;
- LLM audit rows use canonical O/E/D/status/score values;
- report paths referenced by LLM audit rows exist.
