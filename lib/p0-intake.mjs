import { slugify } from './text.mjs';

export const P0_INTAKE_HEADERS = [
  'intake_id',
  'date',
  'requested_object',
  'source_id',
  'company_key',
  'normalized_company_name',
  'country',
  'priority_grade',
  'radar_score',
  'capture_action',
  'required_fields',
  'acceptance_criteria',
  'value_to_fill',
  'guardrail',
];

const REQUEST_DEFINITIONS = {
  evidence_object: {
    table: 'evidence',
    capture_action: 'capture_current_batch_evidence',
    required_fields: 'path_or_url; date_received; summary; is_current_batch; human_review; evidence_level',
    acceptance_criteria: '当前批次视频/照片、官方/现场证明或带日期与复核人的文件。',
    guardrail: '路线统计和能力雷达事实不提升证据。',
  },
  contact_person: {
    table: 'contacts',
    capture_action: 'capture_contact_channel',
    required_fields: 'contact_name; role; whatsapp or email; language; relationship_source; trust_level; next_questions',
    acceptance_criteria: '由现场或商务负责人确认可触达渠道，并记录关系来源。',
    guardrail: '不得从公共路线或能力数据推断联系人渠道。',
  },
  offer_qc: {
    table: 'quotes',
    capture_action: 'collect_offer_qc',
    required_fields: 'product_original; packaging; weekly_volume; price; incoterm; port; payment_terms; processing risk; quoted_at',
    acceptance_criteria: '供应商级报价/QC 说明，包含日期、条款和产品原文。',
    guardrail: '不得从路线统计推导价格或 QC。',
  },
  local_verification_task: {
    table: 'local_tasks',
    capture_action: 'create_local_verification_task',
    required_fields: 'task_name; task_type; must_ask; must_capture; due_date; status',
    acceptance_criteria: '已分配电话/视频/现场任务，包含必问题和必采集媒体清单。',
    guardrail: '任务只是动作请求；返回并复核前不是证据。',
  },
  trial_review: {
    table: 'trials',
    capture_action: 'record_trial_review_after_sample_or_container',
    required_fields: 'product; quantity_mt; packaging; price; processing_method; arrival_quality; actual_loss_percent; actual_margin; repurchase; date',
    acceptance_criteria: '真实样品/试柜加工结果，包含损耗、扣重、买方反馈、利润和复购结果。',
    guardrail: 'D1 仍需交易证据；试柜复盘必须基于真实货物流转。',
  },
};

function rowFor({ date, supplier, requestedObject }) {
  const definition = REQUEST_DEFINITIONS[requestedObject];
  const companySlug = slugify(supplier.company_key || supplier.normalized_company_name || supplier.source_id || 'supplier');
  return {
    intake_id: `intake-${date}-${companySlug}-${requestedObject}`,
    date,
    requested_object: requestedObject,
    source_id: supplier.source_id || '',
    company_key: supplier.company_key || '',
    normalized_company_name: supplier.normalized_company_name || '',
    country: supplier.country || '',
    priority_grade: supplier.priority_grade || '',
    radar_score: String(supplier.radar_score ?? ''),
    capture_action: definition.capture_action,
    required_fields: definition.required_fields,
    acceptance_criteria: definition.acceptance_criteria,
    value_to_fill: '',
    guardrail: definition.guardrail,
  };
}

function emptyTables() {
  return {
    evidence: [],
    contacts: [],
    quotes: [],
    local_tasks: [],
    trials: [],
  };
}

export function buildP0IntakePacket({ date, activationModel }) {
  const tables = emptyTables();
  for (const supplier of activationModel?.suppliers || []) {
    for (const requestedObject of supplier.missing_objects || []) {
      const definition = REQUEST_DEFINITIONS[requestedObject];
      if (!definition) continue;
      tables[definition.table].push(rowFor({ date, supplier, requestedObject }));
    }
  }
  return {
    write_scope: 'reports_only',
    date,
    tables,
    counts: Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length])),
    suppliers: activationModel?.suppliers || [],
  };
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '/');
}

function mdTable(headers, rows) {
  if (!rows.length) return '_None_';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

export function renderP0IntakeIndex({ date, packet, outputPaths = {} }) {
  const outputRows = Object.entries(packet.tables || {}).map(([name, rows]) => [
    name,
    rows.length,
    outputPaths[name] || '',
  ]);
  const supplierRows = (packet.suppliers || []).map(row => [
    row.normalized_company_name,
    row.country,
    row.priority_grade,
    row.radar_score,
    (row.missing_objects || []).join(', '),
  ]);

  return `# Goods Radar P0 采集包

日期：${date}

写入范围：${packet.write_scope}

## 1. 输出

${mdTable(['采集包', '行数', '路径'], outputRows)}

## 2. 供应商范围

${mdTable(['供应商', '国家', '优先级', '雷达分', '请求对象'], supplierRows)}

## 3. 使用规则

- 这些 TSV 是待填写模板，不得直接作为业务事实导入。
- 人工提供已核实证据、联系人、报价、任务或试柜数据前，必须保持 value_to_fill 为空。
- 路线统计不提升证据。
- 能力雷达事实不提升证据。
- D1 仍需提单、发票、贸易或成熟交易证据。
`;
}
