# Goods Radar P0 Import Plan

Date: 2026-06-02

Write scope: reports_only

Import scope: manual_guarded_import_required

## Counts

| Metric | Count |
| --- | --- |
| Draft rows reviewed | 0 |
| Ready to import | 0 |
| Duplicate keys | 0 |
| Validation issues | 0 |
| Blocked rows | 0 |

## Plan Rows

_None_

## Management Actions

- No draft rows are ready for business import.
- No duplicate draft keys detected.
- No draft validation issues detected.
- Do not write data/* from intake drafts without explicit human approval.
- Route statistics and capability radar facts remain outside evidence upgrades.

## Guardrails

- This import plan does not write data/*.
- Ready rows are still not business facts until human approval and a separate guarded import.
- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- D1 requires bill-of-lading, invoice, trade, or mature transaction evidence.
