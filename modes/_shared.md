# Goods Radar Shared Rules

This file is the system rule layer for Agent-mode evaluation. User-specific sourcing preferences belong in `modes/_profile.md` or `config/mission.yml`.

## Sources Of Truth

Always ground evaluation in project data:

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

## Hard Guardrails

- Public route statistics only affect `route_feasibility`; they never raise `evidence_level`.
- Capability radar facts only affect `radar_score`, `priority_grade`, and sourcing rationale; they never raise `evidence_level`.
- Do not mark `D1` unless bill-of-lading, trade, invoice, or mature transaction evidence exists.
- Do not invent suppliers, registrations, shipments, buyers, prices, ports, certificates, photos, or visits.
- Do not convert weak web text into supplier proof. Official lists need registration or structured source context.
- Missing current media, local verification, or shipment evidence means the next action should request proof rather than assume readiness.
- The goal is underdeveloped sourcing potential, not merely already-mature traded suppliers.
- Hidden supply analysis should look for capacity, byproduct handling, export readiness, cold-chain path, and market whitespace before mature bills appear.

## Canonical Levels

- Omasum confirmation: `O0` to `O5`
- Evidence level: `E0` to `E5`
- Development distance: `D1` to `D5`

Preferred targets are usually `D2/D3` with credible official or operational signals and a clear next verification action.

## Canonical Statuses

Use only these company statuses:

`未联系`, `已联系`, `要视频`, `待本地核实`, `待拜访`, `试加工`, `试柜`, `复购`, `观察`, `淘汰`

## Evidence Interpretation

- `E1`: official list, website, weak signal, or manually entered lead.
- `E2`: bill of lading, customs/trade detail, invoice, or transaction record.
- `E3`: current photos or video.
- `E4`: local/field verification.
- `E5`: trial shipment, repeat purchase, or confirmed transaction performance.

When uncertain, keep the lower evidence level and ask for the missing proof.
