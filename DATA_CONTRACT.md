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
| `reports/data-framework/*` | Data framework coverage, source status, gap, and management reports |
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
- `npm run data:framework` generates the TSV-first data framework management report.
- `npm run data:intake` creates fill-in TSV intake packets for P0 capture actions under `reports/data-framework/intake/`.
- `npm run data:intake:check` reviews filled intake packets before any guarded import or business-table write.
- `npm run data:intake:draft` maps `ready_for_mapping` intake rows into schema-shaped draft TSVs under `reports/`, not `data/*`.
- `npm run data:intake:plan` reviews draft TSV rows against existing P0 business tables and writes an import plan under `reports/`, not `data/*`.
- `npm run data:ops` writes a one-page data operations cockpit summarizing source, staging, P0, intake, draft, import-plan, and import readiness.
- `npm run data:p0` ranks supplier-level P0 gaps and turns missing evidence/contact/offer/task/trial objects into capture actions without writing `data/*`.
- `npm run data:probe` runs a staged source-acquisition probe and writes only under `reports/data-framework/`.
- `npm run data:review` reviews staged probe rows for duplicates, provenance gaps, and guarded promotion candidates without writing `data/*`.
- Codex can reason, rank, and explain, but Node applies hard evidence and route guardrails before writing data.
- Public statistics never upgrade evidence; they only affect `route_feasibility`.
- Capability radar facts can raise `radar_score` and `priority_grade`; they never upgrade evidence or create `D1`.
- Optional bill-of-lading data can create E2/D1 mature references, but it is not required for discovering underdeveloped sources.

## TSV-First Data Framework V2

Goods Radar stays TSV-first for the MVP, but the data roles are PostgreSQL-ready. Each TSV maps to a durable object that can later become a relational table without changing sourcing rules.

| Data Object | Current TSV | PostgreSQL-Ready Purpose |
| --- | --- | --- |
| `supplier_master` | `data/companies.tsv` | Supplier/company identity, current guarded score, O/E/D levels, status, and next action |
| `facility_capability` | `data/factory-capabilities.tsv` | Official plant, processor, cold-chain, species, byproduct, and source traceability facts |
| `capacity_signal` | `data/slaughter-capacity.tsv` | Plant/month or region capacity facts used for hidden-supply radar only |
| `export_approval` | `data/export-approvals.tsv` | Destination market and approval facts used for export-readiness radar only |
| `route_signal` | `data/trade-routes.tsv` | Public HS route statistics used only for route feasibility |
| `evidence_object` | `data/evidence.tsv` and optional file/object URIs | Documents, photos, video, field proof, current-batch flags, review, and evidence level |
| `contact_person` | `data/contacts.tsv` | Relationship path, language, trust, last summary, and next questions |
| `offer_qc` | `data/quotes.tsv` | Product wording, packaging, Incoterm, price, volume, processing ability, and QC risks |
| `local_verification_task` | `data/local-tasks.tsv` | Phone/video/field tasks, required questions, required media, due dates, and conclusions |
| `trial_review` | `data/trials.tsv` | Trial processing/shipment outcome, loss, deductions, buyer feedback, margin, and repurchase |
| `mature_transaction_reference` | `data/bill-of-lading.tsv` | Optional E2/D1 mature references for calibration, not a discovery prerequisite |
| `score_audit` | `data/radar-scores.tsv`, `data/llm-evaluations.tsv`, `reports/evaluations/*` | Rule, radar, and Codex evaluation audit trail |

The P0 closed loop is `supplier_master -> evidence_object -> offer_qc -> local_verification_task -> trial_review -> score_audit`. Empty P0 tables are treated as schema-only and must be activated before the project can claim a complete evidence-driven sourcing system.

## P0 Capture Quality Rules

Schema-only empty tables are valid during rollout, but any populated P0 row must pass minimum management checks:

- `data/contacts.tsv`: contact rows require contact ID, company key, normalized company name, and at least one reachable channel (`whatsapp` or `email`).
- `data/quotes.tsv`: quote/QC rows require quote ID, company key, normalized company name, product wording, price, Incoterm, and quote date.
- `data/trials.tsv`: trial rows require trial ID, company key, normalized company name, country, product, positive quantity, date, and any loss percentage must be between 0 and 100.

These checks keep relationship, commercial, and trial data PostgreSQL-ready without inventing evidence or changing the existing TSV-first workflow.

## Management Reporting

`npm run data:framework` reads the current TSV files and source history without contacting external services. It writes `reports/data-framework/<date>-data-framework.md` with:

- table coverage and empty-table gaps;
- usable and blocked data-source snapshots from collection, route, and radar health logs;
- P0 closed-loop gaps and recommended management actions;
- hard guardrail reminders that route statistics and capability radar facts never upgrade evidence, and D1 still requires transaction evidence.

`npm run data:intake` creates fill-in TSV packets for the current P0 worklist. These files prefill supplier identity, requested object, required fields, acceptance criteria, and guardrails, but leave `value_to_fill` empty. They are operational templates only and must not be imported as business facts until a human supplies verified values.

Filled intake values use semicolon-separated `field=value` pairs in `value_to_fill`, for example `contact_name=Maria; whatsapp=+598...; role=sales`. `npm run data:intake:check` classifies each row as `pending_fill`, `incomplete`, or `ready_for_mapping`. A `ready_for_mapping` row is still not a business fact until it passes human review and a guarded import into the proper TSV schema.

`npm run data:intake:draft` takes only `ready_for_mapping` intake rows and writes draft TSVs shaped like `data/evidence.tsv`, `data/contacts.tsv`, `data/quotes.tsv`, `data/local-tasks.tsv`, and `data/trials.tsv` under the intake report directory. These drafts are review artifacts; they must not be copied into business tables without a guarded import and validation.

`npm run data:intake:plan` reads draft TSVs and the existing P0 business TSVs, detects validation issues and duplicate IDs, and writes `IMPORT_PLAN.md`. A ready row in this plan is still not a business fact; it only means the row has passed the import-plan review gate and may be considered for a separate, explicit, guarded business-table write.

`npm run data:ops` summarizes the entire reports-only operating chain: framework gaps, source probe result, staging review, P0 activation, intake preflight, draft readiness, import-plan readiness, blocked sources, and hard guardrails. It is the management cockpit for deciding whether the system is still waiting on human P0 data, ready for draft generation, ready for import-plan review, or ready for explicit guarded import execution.

`npm run data:p0` reads supplier master, radar scores, contacts, evidence, quotes, local tasks, and trials. It writes a prioritized P0 activation worklist under `reports/data-framework/`, showing which suppliers need current-batch evidence, contact channels, offer/QC records, local verification tasks, or trial reviews. It is a management report only and must not invent facts or write `data/*`.

`npm run data:probe` attempts staged acquisition from configured lead sources, route sources, and capability-radar derivation. It writes probe outputs such as staged leads, route signals, radar rows, source health, and a source probe report under `reports/data-framework/`; it must not promote rows into `data/*` by itself.

`npm run data:review` reads a probe staging directory and compares staged rows with the current supplier master. It classifies staged leads as `promote_candidate`, `duplicate`, or `needs_fix`, matches capability facts to existing companies when possible, and keeps route rows as route-only management evidence. Promotion into `data/*` remains a separate guarded import decision.
