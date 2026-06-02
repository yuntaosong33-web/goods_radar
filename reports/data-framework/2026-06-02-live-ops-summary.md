# Goods Radar 数据运营总览

日期：2026-06-02

整体状态：waiting_for_human_p0_data

业务导入就绪：否

## 1. 阶段状态

| 阶段 | 状态 | 详情 |
| --- | --- | --- |
| data_framework | p0_gaps_visible | {"p0_gap_roles":["evidence_object","offer_qc","trial_review"],"usable_sources":["brazil_mapa_dipoa","paraguay_senacsa_frigorificos","uruguay_meats_exporters","brazil_comex_stat","brazil_mapa_sif_open_data","paraguay_senacsa_faena","uruguay_inac_mgap","argentina_senasa_registros","chile_sag_leepp","colombia_invima_carne"],"blocked_sources":["un_comtrade"]} |
| source_probe | source_data_available | {"rows":39,"blocked_sources":["paraguay_senacsa_frigorificos","un_comtrade","brazil_mapa_sif_open_data","paraguay_senacsa_faena","argentina_senasa_registros","chile_sag_leepp","colombia_invima_carne"]} |
| country_context | country_context_available | {"context_rows":12,"countries":6,"indicators":2,"blocked_sources":0} |
| logistics_context | logistics_context_available | {"logistics_rows":12,"countries":6,"indicators":2,"blocked_sources":0} |
| source_evaluation | source_suppliers_evaluated | {"evaluated_suppliers":10,"official_source_suppliers":10,"no_evidence_upgrade_rows":10} |
| staging_review | no_new_promotions | {"staged_leads":18,"promote_candidates":0,"duplicates":18,"needs_fix":0,"staged_capabilities":18,"matched_capabilities":18,"unmatched_capabilities":0,"staged_routes":3,"blocked_sources":7} |
| p0_activation | p0_worklist_active | {"suppliers_reviewed":34,"suppliers_with_p0_gaps":10,"evidence_missing":10,"contact_missing":10,"offer_missing":10,"local_task_missing":8,"trial_missing":10} |
| intake_preflight | pending_human_fill | {"rows_reviewed":48,"pending_fill":48,"incomplete":0,"ready_for_mapping":0} |
| intake_draft | no_draft_rows | {"rows_reviewed":48,"ready_rows":0,"skipped_rows":48,"evidence":0,"contacts":0,"quotes":0,"local_tasks":0,"trials":0,"validation_issues":0} |
| import_plan | no_import_candidates | {"draft_rows_reviewed":0,"ready_to_import":0,"duplicate_key":0,"validation_issue":0,"blocked":0} |

## 2. 管理动作

- 处理受阻数据源或记录明确暂缓：un_comtrade, paraguay_senacsa_frigorificos, brazil_mapa_sif_open_data, paraguay_senacsa_faena, argentina_senasa_registros, chile_sag_leepp, colombia_invima_carne。
- 使用 10 行真实源供应商初评安排触达优先级；不得当作业务事实。
- 使用 12 行国家背景丰富排序理由；不得当作供应商证据。
- 使用 12 行物流背景丰富路线可行性检查；不得当作供应商证据。
- 推进 P0 激活清单中的 10 个优先供应商。
- 为 48 行 intake 填写已核实的 field=value 值。
- intake 行达到 ready_for_mapping 且草稿验证通过前，不要写入业务 P0 表。
- 路线统计和能力雷达事实不得进入证据升级。
- D1 仍需提单、发票、贸易或成熟交易证据。

## 3. 硬守门规则

- 路线统计不提升证据。
- 能力雷达不提升证据。
- 草稿行在受控导入前不是业务事实。
- 导入计划只是管理闸门，不代表自动批准写入 data/*。
- 真实源初评只是优先级测试，不写入供应商主档。
- D1 必须有提单、发票、贸易或成熟交易证据。
