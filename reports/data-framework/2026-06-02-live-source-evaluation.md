# Goods Radar 真实源供应商初评

评估日期：2026-06-02

写入范围：reports_only

评估范围：real_source_staging_initial_assessment

## 1. 统计概览

| 指标 | 数量 |
| --- | --- |
| 已初评供应商 | 10 |
| 官方来源供应商 | 10 |
| 路线信号行 | 3 |
| 能力雷达行 | 18 |
| 未提升证据的行 | 10 |

真实来源 ID：uruguay_meats_exporters

## 2. 初评候选供应商

| 供应商 | 国家 | 来源 | 注册/编号 | O/E/D | 路线 | 规则分 | 雷达分 | 优先级 | 国家背景 | 物流背景 | 初步判断 | 下一步动作 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FRIGOSALTO – Somicar | Uruguay | uruguay_meats_exporters | INAC-74 | O1/E1/D2 | unknown | 62 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| Frigorífico Carrasco | Uruguay | uruguay_meats_exporters | INAC-3 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| Frigorifico PUL | Uruguay | uruguay_meats_exporters | INAC-7 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| Frigorífico Casa Blanca | Uruguay | uruguay_meats_exporters | INAC-58 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| FRIGORÍFICO Schneck | Uruguay | uruguay_meats_exporters | INAC-52 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| Frigoyi – Bilacor | Uruguay | uruguay_meats_exporters | INAC-26 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| Frigorifico Rosario – Rondatel | Uruguay | uruguay_meats_exporters | INAC-22 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| Frigorífico durazno | Uruguay | uruguay_meats_exporters | INAC-14 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| Frigorífico San Jacinto | Uruguay | uruguay_meats_exporters | INAC-344 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |
| Frigorifico Modelo | Uruguay | uruguay_meats_exporters | INAC-20 | O1/E1/D2 | unknown | 58 | 41 | D | 5 | 5 | official_source_verify_product_scope | 索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。 |

## 3. 管理动作

- 使用官方来源候选进行供应商触达和产品范围核实，不自动晋级。
- 在任何 E3+ 或 P0 可联系判断前，必须索取当前批次 omasum/librillo/folhoso 媒体。
- 路线统计、能力雷达、国家背景和物流背景都不得提升证据等级。
- 只有单独的受控导入流程才能把审核后的供应商事实写入 data/*。

## 4. 硬守门规则

- 本报告不写入 data/*。
- 路线统计不提升证据。
- 能力雷达不提升证据。
- 国家宏观背景不提升证据。
- 物流背景不提升证据。
- D1 必须有提单、发票、贸易或成熟交易证据。
