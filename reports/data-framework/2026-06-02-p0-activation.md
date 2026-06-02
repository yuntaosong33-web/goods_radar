# Goods Radar P0 Activation

Date: 2026-06-02

Write scope: reports_only

## Coverage Counts

| Metric | Count |
| --- | --- |
| Suppliers reviewed | 34 |
| Suppliers listed with P0 gaps | 10 |
| Evidence missing | 10 |
| Contact missing | 10 |
| Offer/QC missing | 10 |
| Local task missing | 8 |
| Trial review missing | 10 |

## Priority Worklist

| Supplier | Country | Grade | Radar | D | Missing Objects | Capture Actions | Current Next Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FRIGORIFICO FRIGOMERC | Paraguay | A | 87 | D2 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, create_local_verification_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| Frigorífico Carrasco | Uruguay | A | 83 | D2 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, create_local_verification_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| A Frigorifico Paraguay | Paraguay | D | 40 | D2 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 要视频：索取当前原料、清洗、盐腌、包装和冷库视频 |
| C Subprodutos Bovinos | Brazil | D | 40 | D3 | evidence_object, contact_person, offer_qc, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, complete_existing_local_task, record_trial_review_after_sample_or_container | 要视频：索取当前原料、清洗、盐腌、包装和冷库视频 |
| FRIGOCHORTI | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, create_local_verification_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO BELEN | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, create_local_verification_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO CONCEPCION | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, create_local_verification_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO FRIGOCHACO | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, create_local_verification_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO GUARANI C I | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, create_local_verification_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |
| FRIGORIFICO LOMBARDO | Paraguay | D | 38 | D2 | evidence_object, contact_person, offer_qc, local_verification_task, trial_review | capture_current_batch_evidence, capture_contact_channel, collect_offer_qc, create_local_verification_task, record_trial_review_after_sample_or_container | 补证据：确认是否为 omasum / omaso / librillo / folhoso |

## Management Actions

- Capture current-batch evidence for 10 priority supplier(s): video/photo, batch date, source URL/file, and human review.
- Capture reachable contact channels for 10 supplier(s), preferably WhatsApp plus role/language/source.
- Collect offer/QC records for 10 supplier(s): product wording, packaging, weekly volume, price, Incoterm, port, payment terms, and processing risk.
- Create local verification tasks for 8 supplier(s) with must-ask and must-capture fields.
- Record trial reviews after sample/container movement for 10 supplier(s): quantity, loss, deductions, margin, buyer feedback, and repurchase.
- Do not upgrade evidence from route statistics or capability radar facts.
- D1 still requires transaction evidence such as bill-of-lading, invoice, trade, or mature shipment proof.

## Guardrails

- This report must not invent evidence or write data/*.
- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- D1 still requires transaction evidence such as bill-of-lading, invoice, trade, or mature shipment proof.
