# Goods Radar Data Ops Summary

Date: 2026-06-02

Overall status: waiting_for_human_p0_data

Ready for business import: no

## Stage Status

| Stage | Status | Detail |
| --- | --- | --- |
| data_framework | p0_gaps_visible | {"p0_gap_roles":["evidence_object","offer_qc","trial_review"],"usable_sources":["brazil_mapa_dipoa","paraguay_senacsa_frigorificos","uruguay_meats_exporters","brazil_comex_stat","brazil_mapa_sif_open_data","paraguay_senacsa_faena","uruguay_inac_mgap","argentina_senasa_registros","chile_sag_leepp","colombia_invima_carne"],"blocked_sources":["un_comtrade"]} |
| source_probe | source_data_available | {"rows":39,"blocked_sources":["paraguay_senacsa_frigorificos","un_comtrade","brazil_mapa_sif_open_data","paraguay_senacsa_faena","argentina_senasa_registros","chile_sag_leepp","colombia_invima_carne"]} |
| staging_review | no_new_promotions | {"staged_leads":18,"promote_candidates":0,"duplicates":18,"needs_fix":0,"staged_capabilities":18,"matched_capabilities":18,"unmatched_capabilities":0,"staged_routes":3,"blocked_sources":7} |
| p0_activation | p0_worklist_active | {"suppliers_reviewed":34,"suppliers_with_p0_gaps":10,"evidence_missing":10,"contact_missing":10,"offer_missing":10,"local_task_missing":8,"trial_missing":10} |
| intake_preflight | pending_human_fill | {"rows_reviewed":48,"pending_fill":48,"incomplete":0,"ready_for_mapping":0} |
| intake_draft | no_draft_rows | {"rows_reviewed":48,"ready_rows":0,"skipped_rows":48,"evidence":0,"contacts":0,"quotes":0,"local_tasks":0,"trials":0,"validation_issues":0} |
| import_plan | no_import_candidates | {"draft_rows_reviewed":0,"ready_to_import":0,"duplicate_key":0,"validation_issue":0,"blocked":0} |

## Management Actions

- Resolve blocked sources or record explicit deferral: un_comtrade, paraguay_senacsa_frigorificos, brazil_mapa_sif_open_data, paraguay_senacsa_faena, argentina_senasa_registros, chile_sag_leepp, colombia_invima_carne.
- Work the P0 activation list for 10 priority supplier(s).
- Fill 48 intake row(s) with verified field=value pairs.
- Do not write business P0 tables until intake rows become ready_for_mapping and draft validation passes.
- Keep route statistics and capability radar facts out of evidence upgrades.
- D1 still requires bill-of-lading, invoice, trade, or mature transaction evidence.

## Guardrails

- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- Draft rows are not business facts until a guarded import writes validated data/* rows.
- Import plans are management gates, not implicit approval to write data/*.
- D1 requires bill-of-lading, invoice, trade, or mature transaction evidence.
