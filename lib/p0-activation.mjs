import { companyKey, slugify } from './text.mjs';

const PRIORITY_ORDER = new Map([
  ['A', 5],
  ['B', 4],
  ['C', 3],
  ['D', 2],
  ['E', 1],
]);

function clean(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function supplierKey(row) {
  return row.company_key || companyKey(row.normalized_company_name || row.raw_company_name, row.country);
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

function rowsByCompanyKey(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = supplierKey(row);
    if (!key || key === ':') continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function radarBySourceAndKey(rows) {
  const bySource = new Map();
  const byKey = new Map();
  for (const row of rows || []) {
    if (row.source_id) bySource.set(row.source_id, row);
    if (row.company_key) byKey.set(row.company_key, row);
  }
  return { bySource, byKey };
}

function priorityScore(company, radar) {
  const grade = clean(radar?.priority_grade || company.priority_grade).toUpperCase();
  return [
    PRIORITY_ORDER.get(grade) || 0,
    number(radar?.radar_score || company.radar_score),
    number(company.score),
  ];
}

function comparePriority(left, right) {
  for (const index of [0, 1, 2]) {
    if (right.priority_tuple[index] !== left.priority_tuple[index]) {
      return right.priority_tuple[index] - left.priority_tuple[index];
    }
  }
  return left.normalized_company_name.localeCompare(right.normalized_company_name);
}

function p0State({ key, evidence, contacts, quotes, trials, localTasks }) {
  return {
    has_evidence: (evidence.get(key) || []).length > 0,
    has_contact: (contacts.get(key) || []).length > 0,
    has_offer_qc: (quotes.get(key) || []).length > 0,
    has_local_task: (localTasks.get(key) || []).length > 0,
    has_trial_review: (trials.get(key) || []).length > 0,
  };
}

function missingObjects(p0) {
  return [
    !p0.has_evidence ? 'evidence_object' : '',
    !p0.has_contact ? 'contact_person' : '',
    !p0.has_offer_qc ? 'offer_qc' : '',
    !p0.has_local_task ? 'local_verification_task' : '',
    !p0.has_trial_review ? 'trial_review' : '',
  ].filter(Boolean);
}

function captureActions(p0) {
  const actions = [];
  if (!p0.has_evidence) actions.push('capture_current_batch_evidence');
  if (!p0.has_contact) actions.push('capture_contact_channel');
  if (!p0.has_offer_qc) actions.push('collect_offer_qc');
  if (!p0.has_local_task) actions.push('create_local_verification_task');
  else actions.push('complete_existing_local_task');
  if (!p0.has_trial_review) actions.push('record_trial_review_after_sample_or_container');
  return actions;
}

function managementActions(suppliers) {
  const actions = [];
  const evidenceCount = suppliers.filter(row => row.missing_objects.includes('evidence_object')).length;
  const contactCount = suppliers.filter(row => row.missing_objects.includes('contact_person')).length;
  const quoteCount = suppliers.filter(row => row.missing_objects.includes('offer_qc')).length;
  const trialCount = suppliers.filter(row => row.missing_objects.includes('trial_review')).length;
  const localTaskCount = suppliers.filter(row => row.missing_objects.includes('local_verification_task')).length;

  if (evidenceCount) actions.push(`为 ${evidenceCount} 个优先供应商采集当前批次证据：视频/照片、批次日期、来源 URL/文件和人工复核。`);
  if (contactCount) actions.push(`为 ${contactCount} 个供应商采集可触达联系人，优先记录 WhatsApp、角色、语言和关系来源。`);
  if (quoteCount) actions.push(`为 ${quoteCount} 个供应商采集报价/QC：产品原文、包装、周供货量、价格、Incoterm、港口、付款条款和加工风险。`);
  if (localTaskCount) actions.push(`为 ${localTaskCount} 个供应商创建本地核实任务，明确 must_ask 和 must_capture 字段。`);
  if (trialCount) actions.push(`为 ${trialCount} 个供应商在样品/试柜后记录试柜复盘：数量、损耗、扣重、利润、买方反馈和复购。`);
  actions.push('不得用路线统计或能力雷达事实提升证据等级。');
  actions.push('D1 仍需提单、发票、贸易或成熟出货等交易证据。');
  return unique(actions);
}

function dueDate(createdAt, days = 7) {
  const date = new Date(`${createdAt}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function existingTaskKeys(rows) {
  return new Set((rows || [])
    .filter(row => !['已完成', '取消'].includes(clean(row.status)))
    .map(row => clean(row.company_key))
    .filter(Boolean));
}

export function buildLocalVerificationTaskRows({ suppliers = [], existingTasks = [], createdAt } = {}) {
  const activeKeys = existingTaskKeys(existingTasks);
  const rows = [];
  for (const supplier of suppliers) {
    if (!supplier.missing_objects?.includes('local_verification_task')) continue;
    if (!supplier.company_key || activeKeys.has(supplier.company_key)) continue;
    const slug = slugify(`${supplier.country}-${supplier.normalized_company_name}`);
    rows.push({
      task_id: `local-${slug}-${createdAt}`,
      company_key: supplier.company_key,
      normalized_company_name: supplier.normalized_company_name,
      country: supplier.country,
      city: '',
      task_name: `核实 ${supplier.normalized_company_name} 是否存在可开发 Omasum 货源`,
      task_type: '电话/拍照/询价',
      assignee: '',
      must_ask: '是否有 omaso/librillo/folhoso;每周屠宰或收集量;当前卖给谁;是否与 rumen/honeycomb 混装;是否能清洗盐腌分拣包装;是否允许现场看货;是否能发海防/香港/中国',
      must_capture: '公司门头照片;GPS 地址;负责人姓名和 WhatsApp;当前原料视频;清洗盐腌包装冷库视频;报价或本地销售价格;来源类型判断：源头/中间商/不确定',
      due_date: dueDate(createdAt, 7),
      returned_result: '',
      ai_processing_status: '待处理',
      conclusion: '',
      status: '待处理',
      created_at: createdAt,
    });
    activeKeys.add(supplier.company_key);
  }
  return rows;
}

export function buildP0ActivationModel({
  companies = [],
  radarScores = [],
  evidenceRows = [],
  contactRows = [],
  quoteRows = [],
  trialRows = [],
  localTasks = [],
  limit = 10,
} = {}) {
  const evidence = rowsByCompanyKey(evidenceRows);
  const contacts = rowsByCompanyKey(contactRows);
  const quotes = rowsByCompanyKey(quoteRows);
  const trials = rowsByCompanyKey(trialRows);
  const tasks = rowsByCompanyKey(localTasks);
  const radarIndex = radarBySourceAndKey(radarScores);

  const suppliers = (companies || [])
    .map(company => {
      const key = supplierKey(company);
      const radar = radarIndex.bySource.get(company.source_id) || radarIndex.byKey.get(key) || {};
      const p0 = p0State({ key, evidence, contacts, quotes, trials, localTasks: tasks });
      const missing = missingObjects(p0);
      const priority_tuple = priorityScore(company, radar);
      return {
        source_id: company.source_id,
        company_key: key,
        normalized_company_name: company.normalized_company_name || company.raw_company_name || '',
        country: company.country || '',
        development_distance: company.development_distance || '',
        priority_grade: clean(radar.priority_grade || company.priority_grade),
        radar_score: number(radar.radar_score || company.radar_score),
        score: number(company.score),
        next_action: company.next_action || radar.recommended_verification || '',
        recommended_verification: radar.recommended_verification || '',
        p0,
        missing_objects: missing,
        capture_actions: captureActions(p0),
        priority_tuple,
      };
    })
    .filter(row => row.company_key && row.company_key !== ':' && row.missing_objects.length)
    .sort(comparePriority)
    .slice(0, limit)
    .map(({ priority_tuple, ...row }) => row);

  return {
    write_scope: 'reports_only',
    counts: {
      suppliers_reviewed: companies.length,
      suppliers_with_p0_gaps: suppliers.length,
      evidence_missing: suppliers.filter(row => row.missing_objects.includes('evidence_object')).length,
      contact_missing: suppliers.filter(row => row.missing_objects.includes('contact_person')).length,
      offer_missing: suppliers.filter(row => row.missing_objects.includes('offer_qc')).length,
      local_task_missing: suppliers.filter(row => row.missing_objects.includes('local_verification_task')).length,
      trial_missing: suppliers.filter(row => row.missing_objects.includes('trial_review')).length,
      generated_local_tasks: 0,
    },
    suppliers,
    next_management_actions: managementActions(suppliers),
  };
}

export function renderP0ActivationReport({ date, model }) {
  const supplierRows = (model.suppliers || []).map(row => [
    row.normalized_company_name,
    row.country,
    row.priority_grade,
    row.radar_score,
    row.development_distance,
    row.missing_objects.join(', '),
    row.capture_actions.join(', '),
    row.next_action || row.recommended_verification,
  ]);
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- 暂无';

  return `# Goods Radar P0 激活

日期：${date}

写入范围：${model.write_scope}

## 1. 覆盖统计

| 指标 | 数量 |
| --- | --- |
| 已审阅供应商 | ${model.counts.suppliers_reviewed} |
| 存在 P0 缺口的供应商 | ${model.counts.suppliers_with_p0_gaps} |
| 缺当前证据 | ${model.counts.evidence_missing} |
| 缺联系人 | ${model.counts.contact_missing} |
| 缺报价/QC | ${model.counts.offer_missing} |
| 缺本地任务 | ${model.counts.local_task_missing} |
| 缺试柜复盘 | ${model.counts.trial_missing} |
| 本次生成本地任务 | ${model.counts.generated_local_tasks || 0} |

## 2. 优先工作清单

${mdTable(['供应商', '国家', '优先级', '雷达分', 'D', '缺失对象', '采集动作', '当前下一步'], supplierRows)}

## 3. 管理动作

${actions}

## 4. 硬守门规则

- 默认报告模式不得写入 data/*，也不得虚构证据。
- 只有显式 --write-tasks 才可写入本地核实任务；任务不是供应商证据。
- 路线统计不提升证据。
- 能力雷达事实不提升证据。
- D1 仍需提单、发票、贸易或成熟出货等交易证据。
`;
}
