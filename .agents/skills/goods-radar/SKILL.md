---
name: goods-radar
description: Agent-mode command router for South American omasum sourcing radar
arguments: mode
user-invocable: true
argument-hint: "[collect | radar | routes | scan | score | score-rules | weekly | verify]"
---

# goods-radar Router

Determine the mode from `$mode`:

| Input | Mode |
| --- | --- |
| empty | discovery |
| `collect` | collect leads |
| `radar` or `collect-radar` | collect six-country capability radar |
| `routes` | collect public route stats |
| `scan` | import collected leads |
| `score` or `evaluate` | full Codex Agent-mode evaluation |
| `score-rules` | rule baseline only |
| `weekly` | weekly report |
| `verify` | pipeline verification |

## Discovery

Show:

```text
goods-radar commands:
  /goods-radar collect      -> collect source leads
  /goods-radar radar        -> collect six-country capability radar
  /goods-radar routes       -> collect HS 0504 route stats
  /goods-radar scan         -> import collected leads
  /goods-radar score        -> Codex Agent-mode evaluation
  /goods-radar score-rules  -> rule baseline only
  /goods-radar weekly       -> weekly report
  /goods-radar verify       -> data/audit verification
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

Then run `npm run score` or provide an equivalent Codex JSON response through `--response-file`.

For `radar`/`collect-radar`, run `npm run collect:radar`. Use `-- --fixture` when validating the built-in six-country capability fixture.

For collection, scanning, verification, and reporting modes, run the corresponding npm script and summarize the command output.
