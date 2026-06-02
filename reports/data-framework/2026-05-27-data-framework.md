# Goods Radar 数据体系管理报告

日期：2026-05-27

## 1. 数据表覆盖情况

| 表 | 角色 | 行数 | 状态 | 管理动作 |
| --- | --- | --- | --- | --- |
| data/companies.tsv | supplier_master | 34 | active | maintain_quality |
| data/factory-capabilities.tsv | facility_capability | 6 | active | maintain_quality |
| data/slaughter-capacity.tsv | capacity_signal | 3 | active | maintain_quality |
| data/export-approvals.tsv | export_approval | 4 | active | maintain_quality |
| data/trade-routes.tsv | route_signal | 3 | active | maintain_quality |
| data/evidence.tsv | evidence_object | 0 | schema_only | activate_data_capture |
| data/contacts.tsv | contact_person | 0 | schema_only | activate_data_capture |
| data/quotes.tsv | offer_qc | 0 | schema_only | activate_data_capture |
| data/local-tasks.tsv | local_verification_task | 2 | active | maintain_quality |
| data/trials.tsv | trial_review | 0 | schema_only | activate_data_capture |
| data/bill-of-lading.tsv | mature_transaction_reference | 0 | schema_only | activate_data_capture |
| data/radar-scores.tsv | capability_score | 34 | active | maintain_quality |
| data/llm-evaluations.tsv | score_audit | 1 | active | maintain_quality |

## 2. P0 数据闭环缺口

- 缺口角色：evidence_object, offer_qc, trial_review
- 解释：P0 闭环要求供应商主档、当前批次证据、报价/QC、本地核实任务、试加工/试柜复盘互相连接。

## 3. 数据源快照

| 数据源 | 状态 | 行数 | 说明 |
| --- | --- | --- | --- |
| brazil_mapa_dipoa | collected | 0 | OK, no matching lead blocks |
| paraguay_senacsa_frigorificos | collected | 15 | OK |
| uruguay_meats_exporters | collected | 18 | OK |
| un_comtrade | auth_required | 0 | COMTRADE_API_KEY is required by the current UN Comtrade API |
| brazil_comex_stat | collected | 3 | OK |
| brazil_mapa_sif_open_data | usable | 1 | OK |
| paraguay_senacsa_faena | usable | 3 | OK |
| uruguay_inac_mgap | usable | 3 | OK |
| argentina_senasa_registros | usable | 2 | OK |
| chile_sag_leepp | usable | 2 | OK |
| colombia_invima_carne | usable | 2 | OK |

- 可用数据源：brazil_mapa_dipoa, paraguay_senacsa_frigorificos, uruguay_meats_exporters, brazil_comex_stat, brazil_mapa_sif_open_data, paraguay_senacsa_faena, uruguay_inac_mgap, argentina_senasa_registros, chile_sag_leepp, colombia_invima_carne
- 需处理数据源：un_comtrade

## 4. Top 管理动作

- 录入当前批次证据：视频、图片、批次时间、checksum，先补齐 E3/E4 升级所需材料。
- 录入报价与 QC：Incoterm、包装、周供货量、加工能力、温控和混货风险。
- 建立试加工/试柜复盘：损耗、扣款、买家反馈、实际利润和复购结果。
- 配置 COMTRADE_API_KEY 或保留 UN Comtrade 为 auth_required 路线源，不得用空数据升级证据。
- 保留 Brazil Comex Stat 为 route_signal_only，用于路线可行性和国家优先级，不提升 evidence_level。
- 守门规则保持不变：路线统计不提升证据，能力雷达不提升证据，D1 必须有交易证据。

## 5. 硬守门提醒

- 公共路线统计只影响 route_feasibility，永不提升 evidence_level。
- 能力雷达事实只影响 radar_score、priority_grade 和寻源理由。
- D1 需要提单、贸易、发票或成熟交易证据。
