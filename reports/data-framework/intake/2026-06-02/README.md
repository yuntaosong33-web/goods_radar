# Goods Radar P0 采集包

日期：2026-06-02

写入范围：reports_only

## 1. 输出

| 采集包 | 行数 | 路径 |
| --- | --- | --- |
| evidence | 10 | reports\data-framework\intake\2026-06-02\evidence-intake.tsv |
| contacts | 10 | reports\data-framework\intake\2026-06-02\contacts-intake.tsv |
| quotes | 10 | reports\data-framework\intake\2026-06-02\quotes-intake.tsv |
| local_tasks | 8 | reports\data-framework\intake\2026-06-02\local-tasks-intake.tsv |
| trials | 10 | reports\data-framework\intake\2026-06-02\trials-intake.tsv |

## 2. 供应商范围

| 供应商 | 国家 | 优先级 | 雷达分 | 请求对象 |
| --- | --- | --- | --- | --- |
| FRIGORIFICO FRIGOMERC | Paraguay | A | 87 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review |
| Frigorífico Carrasco | Uruguay | A | 83 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review |
| A Frigorifico Paraguay | Paraguay | D | 40 | evidence_object, contact_person, offer_qc, trial_review |
| C Subprodutos Bovinos | Brazil | D | 40 | evidence_object, contact_person, offer_qc, trial_review |
| FRIGOCHORTI | Paraguay | D | 38 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review |
| FRIGORIFICO BELEN | Paraguay | D | 38 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review |
| FRIGORIFICO CONCEPCION | Paraguay | D | 38 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review |
| FRIGORIFICO FRIGOCHACO | Paraguay | D | 38 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review |
| FRIGORIFICO GUARANI C I | Paraguay | D | 38 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review |
| FRIGORIFICO LOMBARDO | Paraguay | D | 38 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review |

## 3. 使用规则

- 这些 TSV 是待填写模板，不得直接作为业务事实导入。
- 人工提供已核实证据、联系人、报价、任务或试柜数据前，必须保持 value_to_fill 为空。
- 路线统计不提升证据。
- 能力雷达事实不提升证据。
- D1 仍需提单、发票、贸易或成熟交易证据。
