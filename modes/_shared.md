# Goods Radar Shared Rules

This file is the system rule layer for Agent-mode sourcing assessment. User-specific preferences live in `modes/_profile.md` and `config/mission.yml`.

## Mission Boundary

Goods Radar is a South American omasum source radar. It may rank P0 verification candidates and prepare outreach work, but it must not approve supplier onboarding, payment, shipment, purchase release, or final procurement decisions.

## P0 Candidate Definition

A "P0 待核实候选" is not a proven supplier. It is a candidate with:

- official identity or credible capability signal;
- a public source access path, or a clear action to find one;
- concrete product scope questions for omasum/librillo/folhoso;
- concrete contact, video, quote, QC, and local verification questions;
- explicit disqualifiers that would stop outreach.

P0 readiness can raise outreach priority, but it never upgrades evidence.

## Fact Sources

Use only project data and cited public sources:

- `config/mission.yml` or `config/mission.example.yml`
- `data/companies.tsv`
- `data/factory-capabilities.tsv`
- `data/slaughter-capacity.tsv`
- `data/export-approvals.tsv`
- `data/radar-scores.tsv`
- `data/trade-routes.tsv`
- `data/evidence.tsv`
- `data/bill-of-lading.tsv`
- `data/local-tasks.tsv`
- `docs/source-audit.md`

Allowed public sourcing surfaces are official registers, company websites, official directories, public contact pages, and public trade-route aggregates. Login-gated data, private social messages, map reviews, and unattributed snippets must not become business facts.

## Guardrails

- Do not invent suppliers, registration numbers, shipments, buyers, prices, ports, certificates, contacts, photos, visits, or product facts.
- Route statistics only affect `route_feasibility`; route never upgrades `evidence_level` and never creates D1.
- Capability radar facts only affect `radar_score`, `priority_grade`, `p0_readiness`, and outreach priority; radar never upgrades `evidence_level`.
- D1 requires bill of lading, invoice, trade transaction, repeat purchase, trial, or equivalent transaction evidence.
- Official factory, slaughter, export, byproduct, capacity, or cold-chain signals are reasons to verify product scope, not proof of omasum supply.
- High radar but low product evidence official factories should enter `product_scope_needed`, not be discarded simply because they are O1/O2.
- D1 mature rows are calibration references. They should not dominate discovery unless `--include-mature` is requested.
- When uncertain, keep evidence lower and turn missing facts into verification questions.

## Output Levels

- Omasum confirmation: `O0` to `O5`
- Evidence level: `E0` to `E5`
- Development distance: `D1` to `D5`

Preferred discovery targets are usually D2/D3 candidates with official identity, credible plant/byproduct/capacity/export/cold-chain signal, and a clear next verification action.

## P0 Readiness Values

- `outreach_ready`: public access path exists and the product/contact questions are specific enough for manual outreach.
- `contact_needed`: capability or identity signal exists, but public contact path is missing.
- `product_scope_needed`: official or high-radar source exists, but omasum/librillo/folhoso scope is not proven.
- `watchlist`: keep for monitoring; not ready for outreach.
- `reject`: irrelevant, unverifiable, blocked, grey-source, or disqualified.

## Evidence Interpretation

- `E1`: official list, company website, weak public signal, or manual lead.
- `E2`: bill of lading, customs/trade detail, invoice, or transaction record.
- `E3`: current product photo or video.
- `E4`: local or field verification.
- `E5`: trial, repeat purchase, or confirmed transaction performance.
