# Goods Radar P0 激活

日期：2026-06-02

写入范围：reports_only

## 1. 覆盖统计

| 指标 | 数量 |
| --- | --- |
| 已审阅供应商 | 34 |
| 存在 P0 缺口的供应商 | 10 |
| 缺当前证据 | 10 |
| 缺联系人 | 10 |
| 缺报价/QC | 10 |
| 缺本地任务 | 0 |
| 缺试柜复盘 | 10 |
| 本次生成本地任务 | 0 |

## 2. 优先工作清单

| 供应商 | 国家 | 优先级 | 雷达分 | D | 缺失对象 | 采集动作 | 当前下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FRIGORIFICO FRIGOMERC | Paraguay | A | 87 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| Frigorífico Carrasco | Uruguay | A | 83 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| A Frigorifico Paraguay | Paraguay | D | 40 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 要视频：索取当前原料、清洗、盐腌、包装和冷库视频 |
| C Subprodutos Bovinos | Brazil | D | 40 | D3 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 要视频：索取当前原料、清洗、盐腌、包装和冷库视频 |
| FRIGOCHORTI | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO BELEN | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO CONCEPCION | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO FRIGOCHACO | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO GUARANI C I | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO LOMBARDO | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |

## 3. 管理动作

- 为 10 个优先供应商采集当前批次证据：视频/照片、批次日期、来源 URL/文件和人工复核。
- 为 10 个供应商采集可触达联系人，优先记录 WhatsApp、角色、语言和关系来源。
- 为 10 个供应商采集报价/QC：产品原文、包装、周供货量、价格、Incoterm、港口、付款条款和加工风险。
- 为 10 个供应商在样品/试柜后记录试柜复盘：数量、损耗、扣重、利润、买方反馈和复购。
- 不得用路线统计或能力雷达事实提升证据等级。
- D1 仍需提单、发票、贸易或成熟出货等交易证据。

## 4. 硬守门规则

- 默认报告模式不得写入 data/*，也不得虚构证据。
- 只有显式 --write-tasks 才可写入本地核实任务；任务不是供应商证据。
- 路线统计不提升证据。
- 能力雷达事实不提升证据。
- D1 仍需提单、发票、贸易或成熟出货等交易证据。
