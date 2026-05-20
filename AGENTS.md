# Goods Radar Agent Guide

Goods Radar is an Agent-mode sourcing radar for South American omasum. Codex performs constrained sourcing judgment; Node scripts handle data collection, rule baselines, hard guardrails, audit logs, reports, and verification.

## Main Workflow

1. Collect structured leads and public route signals.
2. Run `npm run score`.
3. Node builds a rule baseline and Codex prompt.
4. Codex returns JSON assessments.
5. Node applies guardrails, writes reports, updates `data/companies.tsv`, and appends `data/llm-evaluations.tsv`.
6. Run `npm run verify`.

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

## Commands

- `npm run collect` - collect official/weak source leads.
- `npm run collect:routes` - collect public route statistics.
- `npm run scan -- --collect` - import collected leads into company records.
- `npm run score:rules` - rule baseline only.
- `npm run score` - full Codex Agent-mode evaluation.
- `npm run verify` - validate data and audit outputs.
- `npm run weekly` - generate weekly report.

## Agent Rules

- Do not invent evidence.
- Route statistics never upgrade evidence.
- D1 requires bill/trade/transaction evidence.
- Prefer underdeveloped D2/D3 candidates with credible next verification steps.
- If Codex CLI cannot run, keep the generated prompt and use `--response-file` to import a Codex response.
