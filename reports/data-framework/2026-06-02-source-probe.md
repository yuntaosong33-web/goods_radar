# Goods Radar Source Probe Report

Date: 2026-06-02

Write scope: reports_only

## Counts

| Object | Rows |
| --- | --- |
| Staged leads | 18 |
| Staged route signals | 3 |
| Staged capabilities | 18 |
| Staged capacities | 0 |
| Staged approvals | 0 |

## Source Status

| Layer | Source | Status | Rows | Reason |
| --- | --- | --- | --- | --- |
| lead_collection | brazil_mapa_dipoa | collected | 0 | OK, no matching lead blocks |
| lead_collection | paraguay_senacsa_frigorificos | error | 0 | fetch failed |
| lead_collection | uruguay_meats_exporters | collected | 18 | OK |
| route_signal | un_comtrade | auth_required | 0 | COMTRADE_API_KEY is required by the current UN Comtrade API |
| route_signal | brazil_comex_stat | collected | 3 | OK |
| factory_capability | brazil_mapa_sif_open_data | manual_required | 0 | Manual official export or parser required |
| factory_capability | paraguay_senacsa_faena | no_structured_rows | 0 | No matched official capability rows |
| factory_capability | uruguay_inac_mgap | usable | 18 | OK |
| factory_capability | argentina_senasa_registros | manual_required | 0 | Manual official export or parser required |
| factory_capability | chile_sag_leepp | manual_required | 0 | Manual official export or parser required |
| factory_capability | colombia_invima_carne | manual_required | 0 | Manual official export or parser required |

- Usable sources: brazil_mapa_dipoa, uruguay_meats_exporters, brazil_comex_stat, uruguay_inac_mgap
- Blocked sources: paraguay_senacsa_frigorificos, un_comtrade, brazil_mapa_sif_open_data, paraguay_senacsa_faena, argentina_senasa_registros, chile_sag_leepp, colombia_invima_carne

## Staging Outputs

| Name | Path |
| --- | --- |
| leadOutputPath | reports\data-framework\staging\2026-06-02\auto-leads.tsv |
| leadHistoryPath | reports\data-framework\staging\2026-06-02\collection-history.tsv |
| routeOutputPath | reports\data-framework\staging\2026-06-02\trade-routes.tsv |
| routeHistoryPath | reports\data-framework\staging\2026-06-02\trade-route-history.tsv |
| capabilityPath | reports\data-framework\staging\2026-06-02\factory-capabilities.tsv |
| capacityPath | reports\data-framework\staging\2026-06-02\slaughter-capacity.tsv |
| approvalPath | reports\data-framework\staging\2026-06-02\export-approvals.tsv |
| healthPath | reports\data-framework\staging\2026-06-02\radar-source-health.tsv |

## Management Actions

- Review staged lead rows, then run scan/import only for rows with official identity and provenance.
- Keep staged route rows as route_signal_only; use them for route feasibility, not evidence upgrades.
- Use staged capability rows only for radar_score, priority_grade, and verification rationale.
- Review blocked source access/parser status: paraguay_senacsa_frigorificos, un_comtrade, brazil_mapa_sif_open_data, paraguay_senacsa_faena, argentina_senasa_registros, chile_sag_leepp, colombia_invima_carne.
- Configure required API credentials only when the source is worth operationalizing.
- Keep staged rows out of data/* until a human or guarded importer approves promotion.
- D1 still requires bill-of-lading, invoice, trade, or mature transaction evidence.

## Guardrails

- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- D1 requires bill-of-lading, invoice, trade, or mature transaction evidence.
