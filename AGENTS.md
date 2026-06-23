# Goods Radar Agent Guide

Goods Radar is an Agent-mode source radar for South American omasum. Codex performs constrained sourcing judgment; Node scripts handle collection, rule baselines, hard guardrails, audit logs, reports, and verification.

This is not a procurement decision system. It may rank outreach targets and prepare verification work, but it must not approve supplier onboarding, payment, shipment, purchase release, or final procurement decisions.

## First Run

1. Run `.\goods-radar.cmd doctor`.
2. If configuration is missing, copy examples into user-layer files:
   - `config/mission.example.yml` -> `config/mission.yml`
   - `config/sources.example.yml` -> `config/sources.yml`
3. Run `.\goods-radar.cmd test`.
4. Run the normal discovery chain:
   - `.\goods-radar.cmd collect`
   - `.\goods-radar.cmd source:providers`
   - `.\goods-radar.cmd radar`
   - `.\goods-radar.cmd products`
   - `.\goods-radar.cmd contacts`
   - `.\goods-radar.cmd source:freshness`
   - `.\goods-radar.cmd score --rank-by p0 --explain-selection`
   - `.\goods-radar.cmd source:gaps`
   - `.\goods-radar.cmd p0`
   - `.\goods-radar.cmd verify`

## Main Workflow

1. Collect structured leads, official/public provider capability staging, capability radar facts, public route signals, and public contact staging.
2. Collect public product-scope evidence staging from company/product/catalog pages.
3. Run `.\goods-radar.cmd scan -- --collect` when collected leads should become company records.
4. Run `.\goods-radar.cmd source:freshness` to inspect stale or broken source collectors.
5. Run `.\goods-radar.cmd score --rank-by p0`.
6. Node builds a rule baseline, capability radar baseline, source feedback adjustment, P0 candidate selection, and Codex prompt.
7. Codex returns JSON assessments.
8. Node applies guardrails, writes reports, updates `data/companies.tsv`, and appends `data/llm-evaluations.tsv`.
9. Run `.\goods-radar.cmd source:gaps` to turn missing contacts, product scope, evidence, and feedback into a sourcing worklist.
10. Run `.\goods-radar.cmd p0` to generate the P0 cockpit.
11. Run `.\goods-radar.cmd verify`.

## Command Router

- `doctor` - first-run and health checks.
- `collect` - collect official/weak source leads.
- `providers`, `source:providers`, or `collect:providers` - run source providers into reports staging plus provider health.
- `radar` or `collect:radar` - collect six-country capability radar facts.
- `routes` or `collect:routes` - collect public HS 0504 route statistics.
- `contacts` or `collect:contacts` - collect public contact clues into reports staging only.
- `products` or `collect:products` - collect public product/catalog clues into reports staging only.
- `contacts:import` - guarded import of human-approved contact staging rows.
- `source:freshness` - source freshness and parser-maintenance report.
- `source:gaps` or `p0:gaps` - P0 source gap worklist for missing contact, product scope, current batch evidence, and feedback closure.
- `scan` - import collected leads into company records.
- `score:rules` - rule baseline only.
- `score` - full Codex Agent-mode evaluation; defaults to `--rank-by p0`.
- `p0` - generate P0 cockpit.
- `weekly` - generate weekly report.
- `verify` - validate data and audit outputs.
- `test` - unit test suite.
- `test-all` - syntax, tests, doctor, verify, dry-run score, and data boundary checks.

## P0 Candidate Standard

"Truly usable source" means P0 verification readiness, not purchase readiness:

- official identity or credible capability signal;
- public source access path or a concrete action to find it;
- clear product-scope questions for omasum/librillo/folhoso;
- clear contact, video, quote, QC, and local verification questions;
- explicit disqualifiers.

P0 readiness values:

- `outreach_ready`
- `contact_needed`
- `product_scope_needed`
- `watchlist`
- `reject`

P0 readiness can raise outreach priority, but it never upgrades `evidence_level` or creates D1.

## Data Contract

Business data is user layer and must not be overwritten casually:

- `config/mission.yml`
- `config/sources.yml`
- `modes/_profile.md`
- `data/*`
- `reports/*`

System layer:

- `AGENTS.md`
- `.agents/skills/goods-radar/SKILL.md`
- `modes/_shared.md`
- `modes/evaluate.md`
- `*.mjs`
- `lib/*.mjs`
- `docs/*`
- tests and fixtures

User-layer files are ignored by Git. Keep local files on disk, but do not track mutable business data.

## Source Policy

- Use official sources, company websites, public directories, public contact pages, public trade-route aggregates, and local fixture/samples.
- Do not use login sources, private messages, map reviews, or social media private channels as business facts.
- Public contact discovery writes only staging files under `reports/data-framework/staging/<date>/contacts.tsv`.
- Public product-scope discovery writes only staging files under `reports/data-framework/staging/<date>/product-scope-evidence.tsv`.
- Source provider runs write official/public capability staging and provider health under `reports/data-framework/staging/<date>/`.
- Source gap worklists write verification actions under `reports/data-framework/<date>-source-gap-worklist.md` and `reports/data-framework/staging/<date>/source-gap-worklist.tsv`.
- Staged contact rows are not verified contacts. They require guarded import before entering `data/contacts.tsv`.
- Staged product-scope rows are not evidence upgrades. They require human review before becoming evidence.
- `data/source-feedback.tsv` records negative sourcing feedback and can downrank future P0 selection without deleting source history.

## Guardrails

- Do not invent evidence.
- Route statistics never upgrade evidence.
- Capability radar facts only raise `radar_score`, `priority_grade`, `p0_readiness`, and outreach priority; they never upgrade evidence.
- D1 requires bill/trade/invoice/transaction/trial/repeat evidence.
- Prefer underdeveloped D2/D3 candidates with credible official capability, byproduct, capacity, export readiness, or cold-chain signals.
- High radar, low product evidence official factories should enter `product_scope_needed`.
- D1 mature samples are calibration rows by default.
- Never approve onboarding, payment, shipment, purchase release, or supplier qualification.

## Failure Recovery

- If Codex CLI cannot run, keep the generated prompt and use `--response-file` to import a Codex response.
- Use `--fallback-rules` only as a clearly labeled rule-baseline fallback.
- Use `--dry-run --prompt-out <temp-file>` when testing prompt generation.
- Run `.\goods-radar.cmd verify` after any data write.
- Run `.\goods-radar.cmd test-all` before claiming the productized CLI is ready.

## Human P0 Closure

P0 is closed only by human-reviewed artifacts:

- current batch photo/video;
- product scope and QC answers;
- public contact path or verified contact row;
- quote or commercial terms;
- local verification, sample, trial, or transaction record.

The agent may prepare the worklist, questions, and reports. A human must decide whether to continue outreach or stop.
