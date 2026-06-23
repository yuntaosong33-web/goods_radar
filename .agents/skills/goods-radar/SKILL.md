---
name: goods-radar
description: Agent-mode command router for South American omasum sourcing radar
arguments: mode
user-invocable: true
argument-hint: "[collect | source:providers | radar | routes | contacts | products | source:freshness | source:gaps | scan | score | score-rules | p0 | weekly | verify | test-all]"
---

# goods-radar Router

Determine the mode from `$mode`.

| Input | Mode |
| --- | --- |
| empty | discovery |
| `collect` | collect leads |
| `source:providers`, `collect-providers`, or `providers` | run official/public source providers into staging |
| `radar` or `collect-radar` | collect six-country capability radar |
| `routes` | collect public route stats |
| `contacts` or `collect-contacts` | collect public contact clues into staging |
| `products` or `collect-products` | collect public product-scope clues into staging |
| `contacts:import` | guarded import of approved contact staging |
| `source:freshness` | source freshness report |
| `source:gaps` or `p0:gaps` | P0 source gap worklist |
| `scan` | import collected leads |
| `score` or `evaluate` | full Codex Agent-mode P0 evaluation |
| `score-rules` | rule baseline only |
| `p0` | generate P0 cockpit |
| `weekly` | weekly report |
| `verify` | pipeline verification |
| `test-all` | productized validation suite |

## Discovery

Show:

```text
goods-radar commands:
  /goods-radar doctor      -> health and first-run checks
  /goods-radar collect     -> collect source leads
  /goods-radar source:providers -> run official/public provider staging
  /goods-radar radar       -> collect six-country capability radar
  /goods-radar routes      -> collect HS 0504 route stats
  /goods-radar contacts    -> collect public contact clues into staging
  /goods-radar products    -> collect product/catalog clues into staging
  /goods-radar source:freshness -> inspect stale or broken sources
  /goods-radar source:gaps -> turn P0 candidates into data-source gap worklist
  /goods-radar scan        -> import collected leads
  /goods-radar score       -> Codex Agent-mode P0 evaluation
  /goods-radar p0          -> P0 cockpit
  /goods-radar verify      -> data/audit verification
  /goods-radar test-all    -> syntax, tests, doctor, verify, score dry-run, data boundary
```

Recommended CLI sequence:

```powershell
.\goods-radar.cmd doctor
.\goods-radar.cmd collect
.\goods-radar.cmd source:providers
.\goods-radar.cmd radar
.\goods-radar.cmd contacts
.\goods-radar.cmd products
.\goods-radar.cmd source:freshness
.\goods-radar.cmd score --rank-by p0 --explain-selection
.\goods-radar.cmd source:gaps
.\goods-radar.cmd p0
.\goods-radar.cmd verify
.\goods-radar.cmd weekly
```

## Context Loading

For `score`/`evaluate`, read:

- `modes/_shared.md`
- `modes/_profile.md`
- `modes/evaluate.md`
- `data/companies.tsv`
- `data/factory-capabilities.tsv`
- `data/slaughter-capacity.tsv`
- `data/export-approvals.tsv`
- `data/radar-scores.tsv`
- `data/trade-routes.tsv`
- `data/evidence.tsv`
- `docs/source-audit.md`

Then run:

```powershell
.\goods-radar.cmd score --rank-by p0 --explain-selection
```

If Codex CLI is unavailable, keep the prompt and import a response through `--response-file`, or explicitly use `--fallback-rules`.

## Guardrails

- P0 means pending verification, not procurement approval.
- Route statistics never upgrade evidence.
- Radar facts never upgrade evidence.
- D1 requires transaction evidence.
- Contact discovery writes staging only; it must not write verified contacts.
- Product-scope discovery writes staging only; it must not upgrade evidence.
- Negative feedback in `data/source-feedback.tsv` downranks future P0 selection.
