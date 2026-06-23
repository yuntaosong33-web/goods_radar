# Goods Radar Setup

## Requirements

- Windows PowerShell.
- Git.
- Node.js 18+ or the bundled Codex desktop Node runtime.

The runner uses `GOODS_RADAR_NODE` first, then global `node`, then the bundled Codex runtime.

## First Run

```powershell
.\goods-radar.cmd doctor
.\goods-radar.cmd test
```

If local config files are missing:

```powershell
Copy-Item config\mission.example.yml config\mission.yml
Copy-Item config\sources.example.yml config\sources.yml
```

## Recommended Workflow

```powershell
.\goods-radar.cmd doctor
.\goods-radar.cmd collect
.\goods-radar.cmd source:providers
.\goods-radar.cmd radar
.\goods-radar.cmd products
.\goods-radar.cmd contacts
.\goods-radar.cmd source:freshness
.\goods-radar.cmd score --rank-by p0 --limit 5 --explain-selection
.\goods-radar.cmd source:gaps
.\goods-radar.cmd p0
.\goods-radar.cmd verify
.\goods-radar.cmd weekly
```

## Data Boundaries

These files are local user layer and ignored by Git:

- `config/mission.yml`
- `config/sources.yml`
- `modes/_profile.md`
- `data/*`
- `reports/*`

Do not commit mutable sourcing state. Commit system changes, tests, docs, examples, and fixtures.

## Validation

```powershell
.\goods-radar.cmd test-all
```

`test-all` verifies syntax, unit tests, doctor, verify, dry-run scoring with a temporary prompt file, and user-layer Git tracking boundaries.
