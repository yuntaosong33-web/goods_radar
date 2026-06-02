# Goods Radar P0 Intake Packet

Date: 2026-06-02

Write scope: reports_only

## Outputs

| Packet | Rows | Path |
| --- | --- | --- |
| evidence | 10 | reports\data-framework\intake\2026-06-02\evidence-intake.tsv |
| contacts | 10 | reports\data-framework\intake\2026-06-02\contacts-intake.tsv |
| quotes | 10 | reports\data-framework\intake\2026-06-02\quotes-intake.tsv |
| local_tasks | 8 | reports\data-framework\intake\2026-06-02\local-tasks-intake.tsv |
| trials | 10 | reports\data-framework\intake\2026-06-02\trials-intake.tsv |

## Supplier Scope

| Supplier | Country | Grade | Radar | Requested Objects |
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

## Use Rules

- These TSVs are fill-in templates and must not be imported as business facts.
- Keep value_to_fill empty until a human supplies verified evidence, contact, quote, task, or trial data.
- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- D1 still requires bill-of-lading, invoice, trade, or mature transaction evidence.
