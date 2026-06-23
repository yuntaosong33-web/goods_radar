# Goods Radar Scripts

Use `.\goods-radar.cmd` on Windows. It resolves the bundled Codex Node runtime when global Node is unavailable.

## Main Commands

- `doctor`: first-run and health checks.
- `collect`: collect configured public leads.
- `source:providers`: run official/public source providers into staging plus provider health.
- `radar`: collect capability radar facts.
- `routes`: collect HS 0504 route statistics.
- `contacts`: collect public contact clues into reports staging.
- `products`: collect public product/catalog clues into reports staging.
- `contacts:import`: guarded import of approved contact staging rows.
- `source:freshness`: inspect source freshness, parser drift, and sources needing refresh.
- `source:gaps`: generate the P0 source gap worklist for missing contact, product scope, current batch evidence, and feedback closure.
- `scan -- --collect`: import collected leads into company records.
- `score`: Codex Agent-mode evaluation; defaults to `--rank-by p0`.
- `score:rules`: deterministic baseline only.
- `p0`: generate P0 cockpit.
- `weekly`: generate weekly summary.
- `verify`: validate data and audit files.
- `test`: run unit tests.
- `test-all`: run syntax checks, tests, doctor, verify, score dry-run, and Git data-boundary checks.

## Score Options

```powershell
.\goods-radar.cmd score --rank-by p0 --limit 5 --explain-selection
```

Options:

- `--rank-by p0|score|radar|file`
- `--min-radar <number>`
- `--include-mature`
- `--explain-selection`
- `--dry-run`
- `--prompt-out <path>`
- `--response-file <path>`
- `--fallback-rules`

`p0` ranking favors high-radar official D2/D3 candidates and downranks mature D1 calibration rows by default.

## Contact Staging

```powershell
.\goods-radar.cmd contacts
```

Writes:

`reports/data-framework/staging/<date>/contacts.tsv`

This file is staging only. It does not update `data/contacts.tsv`.

Approved rows can be imported with:

```powershell
.\goods-radar.cmd contacts:import --staging reports\data-framework\staging\<date>\contacts.tsv
```

Only rows marked `approved` or `verified` are imported.

## Product Scope Staging

```powershell
.\goods-radar.cmd products
```

Writes:

`reports/data-framework/staging/<date>/product-scope-evidence.tsv`

This is not an evidence upgrade. It is a review queue for product/catalog clues such as `librillo`, `omaso`, `folhoso`, and byproduct terms.

## Source Providers

```powershell
.\goods-radar.cmd source:providers
```

Writes:

- `reports/data-framework/staging/<date>/factory-capabilities.tsv`
- `reports/data-framework/staging/<date>/provider-health.tsv`

Provider rows are staging only. They must keep `source_url` provenance and do not directly update `data/factory-capabilities.tsv`.

## Source Freshness

```powershell
.\goods-radar.cmd source:freshness
```

Writes a report and staging TSV showing current, stale, error, and never-collected sources. Freshness never upgrades supplier evidence.

## Source Gap Worklist

```powershell
.\goods-radar.cmd source:gaps --limit 20
```

Writes:

- `reports/data-framework/<date>-source-gap-worklist.md`
- `reports/data-framework/staging/<date>/source-gap-worklist.tsv`

This command answers the practical sourcing question: which high-radar candidates still need public contact discovery, product-scope confirmation, current batch media, or negative-feedback closure. It treats official sources as radar inputs, not procurement proof.

## Recovery

If Codex CLI is unavailable:

1. Run `score --dry-run --prompt-out <file>`.
2. Get a JSON response from Codex or another controlled execution path.
3. Re-run `score --response-file <file>`.
4. Run `verify`.
