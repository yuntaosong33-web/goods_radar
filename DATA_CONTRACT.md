# Data Contract

Goods Radar follows the same layer principle as `career-ops`: system files can evolve, business data and buyer-specific learning must not be overwritten casually.

## User Layer

These files contain sourcing facts, buyer preferences, field feedback, and generated work product:

| File | Purpose |
| --- | --- |
| `config/mission.yml` | Active sourcing mission: product, countries, destinations, keywords, quality standards |
| `config/sources.yml` | Active source configuration and local import paths |
| `modes/_profile.md` | Buyer preferences, scoring corrections, and feedback learning |
| `data/companies.tsv` | Company master records and final guarded scores |
| `data/auto-leads.tsv` | Latest auto-collected candidate leads |
| `data/collection-history.tsv` | Source collection status and errors |
| `data/trade-routes.tsv` | Public route statistics; route feasibility only |
| `data/trade-route-history.tsv` | Public route collection audit |
| `data/bill-of-lading.tsv` | Optional bill-of-lading detail imports |
| `data/factory-capabilities.tsv` | Official factory, processor, cold storage, and byproduct capability base |
| `data/slaughter-capacity.tsv` | Plant/month or region slaughter and capacity signals |
| `data/export-approvals.tsv` | Destination market, product category, and certification/approval signals |
| `data/radar-scores.tsv` | Capability radar component scores and A-E priority |
| `data/radar-source-health.tsv` | Capability source status and audit trail |
| `data/evidence.tsv` | Documents, media, field proof, official evidence |
| `data/llm-evaluations.tsv` | Codex assessment audit after Node guardrails |
| `data/local-tasks.tsv` | Phone/video/field verification tasks |
| `data/contacts.tsv` | Contacts and relationship source |
| `data/quotes.tsv` | Quotes, packaging, ports, payment terms |
| `data/trials.tsv` | Trial shipment and repurchase history |
| `data/scan-history.tsv` | Lead deduplication and import audit |
| `reports/evaluations/*` | A-G Codex sourcing evaluation reports |
| `reports/weekly/*` | Weekly radar reports |
| `samples/*` | Local examples or import fixtures |

## System Layer

These files contain reusable logic, prompts, and validation:

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Codex operating guide |
| `.agents/skills/goods-radar/SKILL.md` | Agent-mode router |
| `modes/_shared.md` | Shared sourcing rules and hard guardrails |
| `modes/evaluate.md` | A-G evaluation mode |
| `modes/*.md` except `_profile.md` | Agent operation modes |
| `*.mjs` | CLI entrypoints |
| `lib/*.mjs` | Shared parsing, scoring, guardrail, TSV, and file utilities |
| `config/*.example.yml` | Example mission/source templates |
| `package.json` | CLI command map |
| `DATA_CONTRACT.md` | This contract |

## Core Rules

- `npm run score` is the Codex Agent-mode evaluation entrypoint.
- `npm run score:rules` is the offline rule baseline.
- `npm run collect:radar` is the six-country capability radar collector.
- Codex can reason, rank, and explain, but Node applies hard evidence and route guardrails before writing data.
- Public statistics never upgrade evidence; they only affect `route_feasibility`.
- Capability radar facts can raise `radar_score` and `priority_grade`; they never upgrade evidence or create `D1`.
- Optional bill-of-lading data can create E2/D1 mature references, but it is not required for discovering underdeveloped sources.
