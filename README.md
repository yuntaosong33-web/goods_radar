# Goods Radar

Goods Radar is an Agent-mode sourcing radar for South American omasum. It discovers underdeveloped sources, grounds them in official/route/evidence data, lets Codex perform constrained sourcing judgment, and lets Node enforce auditability and hard rules.

## Main Flow

```text
collect sources -> collect capability radar -> scan leads -> collect route stats -> rule baseline -> Codex evaluation -> Node guardrails -> reports/tasks/weekly review
```

## Quick Start

```bash
npm run doctor
npm run collect
npm run collect:radar -- --fixture
npm run scan -- --collect
npm run collect:routes -- --period 2024 --hs 0504
npm run score -- --dry-run --limit 1
npm run score -- --response-file samples/codex-evaluation-response.json --source-id py-senacsa-001
npm run verify
npm run weekly
```

If npm is unavailable, use Node directly:

```bash
node doctor.mjs
node collect.mjs
node collect-radar.mjs --fixture
node scan.mjs --collect
node collect-routes.mjs --period 2024 --hs 0504
node score.mjs --dry-run --limit 1
node verify-pipeline.mjs
```

## Evaluation Architecture

`npm run score` is the full Agent-mode evaluation entrypoint:

1. Node runs the rule baseline in memory.
2. Node builds Codex cases with company, route, evidence, radar facts, baseline, and guardrails.
3. Codex evaluates under `modes/_shared.md`, `modes/_profile.md`, and `modes/evaluate.md`.
4. Node parses Codex JSON, applies hard guardrails, writes `data/companies.tsv`, appends `data/llm-evaluations.tsv`, and saves reports in `reports/evaluations/`.

Use `npm run score:rules` for the old offline rule baseline without Codex.

Useful options:

```bash
npm run score -- --limit 5
npm run score -- --source-id py-senacsa-001
npm run score -- --dry-run
npm run score -- --response-file samples/codex-evaluation-response.json
npm run score -- --codex-bin path/to/codex
npm run score -- --skip-apply --response-file samples/codex-evaluation-response.json
```

If Codex CLI cannot start, the prompt remains in `reports/llm-evaluations/`; run Codex in the app or another shell, save the JSON response, then rerun with `--response-file`.

## Capability Radar, Route Stats, And Optional Bill Validation

The capability radar finds hidden supply before mature trade records appear:

- `collect:radar` writes `data/factory-capabilities.tsv`, `data/slaughter-capacity.tsv`, `data/export-approvals.tsv`, and `data/radar-source-health.tsv`.
- `score:rules` computes `data/radar-scores.tsv` and writes `radar_score` plus `priority_grade` to `data/companies.tsv`.
- Radar facts can raise potential priority only; they never raise `evidence_level` and never create `D1`.
- First-version scope covers Brazil, Paraguay, Uruguay, Argentina, Chile, and Colombia. Sources that require login, manual export, or protected access are recorded as `manual_required`.

Public route APIs and bill-of-lading detail are layered:

- `collect:routes` writes `data/trade-routes.tsv` and `data/trade-route-history.tsv`. Public statistics only affect `route_feasibility`; they never raise evidence.
- Brazil Comex Stat uses a single POST aggregate query for Brazil -> Vietnam/Hong Kong/China HS 0504 exports.
- UN Comtrade currently requires `COMTRADE_API_KEY`; without it the collector records `auth_required` and creates no fake rows.
- `import:bol` supports CSV/XLSX and writes optional shipment evidence. Bills can create `E2` and `D1` mature references, but they are not required to discover underdeveloped sources.

## Important Files

| File | Purpose |
| --- | --- |
| `AGENTS.md` | Codex operating guide |
| `.agents/skills/goods-radar/SKILL.md` | Agent-mode router |
| `modes/_shared.md` | System rules and hard guardrails |
| `modes/_profile.md` | Buyer preferences and feedback learning |
| `modes/evaluate.md` | A-G sourcing evaluation mode |
| `data/companies.tsv` | Company master and final guarded scores |
| `data/factory-capabilities.tsv` | Six-country official factory capability base |
| `data/slaughter-capacity.tsv` | Plant/month or region capacity signals |
| `data/export-approvals.tsv` | Destination market and certification signals |
| `data/radar-scores.tsv` | Capability radar score and A-E priority |
| `data/llm-evaluations.tsv` | Codex assessment audit |
| `reports/evaluations/` | Codex A-G evaluation reports |
| `docs/source-audit.md` | Source provenance rules |

## Verification

```bash
npm run test
npm run doctor
npm run verify
```

The verifier checks data headers, canonical levels/statuses, route rows, capability radar rows, bill rows, LLM audit rows, report links, and pipeline formatting.
