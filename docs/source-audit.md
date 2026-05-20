# Source Audit Rules

Goods Radar cannot treat scraped text as supplier truth. Every assessment must separate discovery signals, route signals, supplier evidence, and mature transaction references.

## Structured Sources Currently Usable

| Source | Status | Retrieval | Evidence |
| --- | --- | --- | --- |
| Paraguay SENACSA frigorificos | usable structured source | Official page -> public Google Sheets CSV | SENACSA registration + processor name + destination/product classes |
| Uruguay Meats exporters | usable structured source | Exporter cards | INAC card number + product page URL + company title |
| Brazil Comex Stat | public route API connected | `/general` POST aggregate query | Brazil country/HS route signal only |

## Gated Or Background Sources

| Source | Status | Rule |
| --- | --- | --- |
| Brazil MAPA / DIPOA | entry point only unless structured query works | Do not score entry-page fragments as suppliers |
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

- Codex may reason about supplier potential, risk, and next actions.
- Codex may not invent evidence or create new business facts.
- Public route data can only affect `route_feasibility`.
- Node guardrails cap `evidence_level` and block `D1` when the evidence chain does not support it.
- Every Codex result must be auditable in `data/llm-evaluations.tsv` and, when provided, `reports/evaluations/*`.

## Verification Gate

`verify-pipeline.mjs` checks:

- auto-collected official rows have HTTP source URLs, registration, and structured parsing notes;
- trade route rows are `route_signal_only`;
- bill rows are `E2` and `D1`;
- LLM audit rows use canonical O/E/D/status/score values;
- report paths referenced by LLM audit rows exist.
