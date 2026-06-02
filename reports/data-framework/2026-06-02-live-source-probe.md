# Goods Radar 数据源探测报告

日期：2026-06-02

写入范围：reports_only

## 1. 统计概览

| 对象 | 行数 |
| --- | --- |
| 暂存线索 | 18 |
| 暂存路线信号 | 3 |
| 暂存能力事实 | 18 |
| 暂存产能事实 | 0 |
| 暂存出口批准事实 | 0 |

## 2. 数据源状态

| 层级 | 数据源 | 状态 | 行数 | 原因 |
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

- 可用数据源：brazil_mapa_dipoa, uruguay_meats_exporters, brazil_comex_stat, uruguay_inac_mgap
- 受阻数据源：paraguay_senacsa_frigorificos, un_comtrade, brazil_mapa_sif_open_data, paraguay_senacsa_faena, argentina_senasa_registros, chile_sag_leepp, colombia_invima_carne

## 3. Staging 输出

| 名称 | 路径 |
| --- | --- |
| leadOutputPath | reports\data-framework\staging\2026-06-02-live-smoke\auto-leads.tsv |
| leadHistoryPath | reports\data-framework\staging\2026-06-02-live-smoke\collection-history.tsv |
| routeOutputPath | reports\data-framework\staging\2026-06-02-live-smoke\trade-routes.tsv |
| routeHistoryPath | reports\data-framework\staging\2026-06-02-live-smoke\trade-route-history.tsv |
| capabilityPath | reports\data-framework\staging\2026-06-02-live-smoke\factory-capabilities.tsv |
| capacityPath | reports\data-framework\staging\2026-06-02-live-smoke\slaughter-capacity.tsv |
| approvalPath | reports\data-framework\staging\2026-06-02-live-smoke\export-approvals.tsv |
| healthPath | reports\data-framework\staging\2026-06-02-live-smoke\radar-source-health.tsv |

## 4. 管理动作

- 审核暂存线索行；只有具备官方身份和来源追溯的行，才可进入 scan/import 评审。
- 暂存路线行保持 route_signal_only；仅用于路线可行性，不用于证据升级。
- 暂存能力行仅用于 radar_score、priority_grade 和核实理由。
- 检查受阻数据源的访问或解析状态：paraguay_senacsa_frigorificos, un_comtrade, brazil_mapa_sif_open_data, paraguay_senacsa_faena, argentina_senasa_registros, chile_sag_leepp, colombia_invima_carne。
- 仅当数据源值得进入日常运营时，再配置所需 API 凭证。
- 暂存行在人工或受控导入器批准前不得写入 data/*。
- D1 仍需提单、发票、贸易或成熟交易证据。

## 5. 硬守门规则

- 路线统计不提升证据。
- 能力雷达事实不提升证据。
- D1 需要提单、发票、贸易或成熟交易证据。
