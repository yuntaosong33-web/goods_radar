const P0_CLOSED_LOOP_ROLES = new Set([
  'supplier_master',
  'evidence_object',
  'offer_qc',
  'local_verification_task',
  'trial_review',
]);

const USABLE_SOURCE_STATUSES = new Set(['collected', 'usable']);
const BLOCKED_SOURCE_STATUSES = new Set([
  'auth_required',
  'manual_required',
  'error',
  'blocked',
  'blocked_or_unavailable',
  'no_structured_rows',
]);

function countRows(rows) {
  return Array.isArray(rows) ? rows.length : Number(rows || 0) || 0;
}

function tableStatus(rowCount) {
  return rowCount > 0 ? 'active' : 'schema_only';
}

function managementAction(status) {
  return status === 'active' ? 'maintain_quality' : 'activate_data_capture';
}

function cell(value) {
  return String(value ?? '').replace(/\|/g, '/');
}

function mdTable(headers, rows) {
  if (!rows.length) return '_暂无_';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.map(cell).join(' | ')} |`),
  ].join('\n');
}

export function summarizeTable({ path, layer = '', rows = [], role = '' }) {
  const rowCount = countRows(rows);
  const status = tableStatus(rowCount);
  return {
    path,
    layer,
    role,
    row_count: rowCount,
    status,
    management_action: managementAction(status),
  };
}

function sourceRows(snapshot) {
  return Number(snapshot.rows ?? snapshot.row_count ?? snapshot.lead_count ?? snapshot.route_count ?? 0) || 0;
}

function sourceStatus(snapshot) {
  return String(snapshot.status || '').trim();
}

function sourceId(snapshot) {
  return snapshot.source_id || snapshot.id || '';
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function gapActions(gaps) {
  const actions = [];
  if (gaps.includes('evidence_object')) {
    actions.push('录入当前批次证据：视频、图片、批次时间、checksum，先补齐 E3/E4 升级所需材料。');
  }
  if (gaps.includes('offer_qc')) {
    actions.push('录入报价与 QC：Incoterm、包装、周供货量、加工能力、温控和混货风险。');
  }
  if (gaps.includes('trial_review')) {
    actions.push('建立试加工/试柜复盘：损耗、扣款、买家反馈、实际利润和复购结果。');
  }
  if (gaps.includes('local_verification_task')) {
    actions.push('推进本地核实任务：GPS、门头、负责人、当前视频和来源类型判断必须回传。');
  }
  return actions;
}

function sourceActions(sourceSnapshots) {
  const actions = [];
  const blocked = sourceSnapshots.filter(snapshot => BLOCKED_SOURCE_STATUSES.has(sourceStatus(snapshot)));
  if (blocked.some(snapshot => sourceId(snapshot) === 'un_comtrade' || sourceStatus(snapshot) === 'auth_required')) {
    actions.push('配置 COMTRADE_API_KEY 或保留 UN Comtrade 为 auth_required 路线源，不得用空数据升级证据。');
  }
  if (blocked.some(snapshot => /senacsa/i.test(sourceId(snapshot)) || /senacsa/i.test(snapshot.note || snapshot.reason || ''))) {
    actions.push('将 Paraguay SENACSA 标记为需采集兜底：优先使用官方 CSV/镜像/人工导入，不把 fetch failed 当作无货结论。');
  }
  if (sourceSnapshots.some(snapshot => sourceId(snapshot) === 'brazil_comex_stat' && sourceRows(snapshot) > 0)) {
    actions.push('保留 Brazil Comex Stat 为 route_signal_only，用于路线可行性和国家优先级，不提升 evidence_level。');
  }
  return actions;
}

export function buildDataFrameworkModel({ tableSummaries = [], sourceSnapshots = [] } = {}) {
  const p0_gap_roles = tableSummaries
    .filter(summary => P0_CLOSED_LOOP_ROLES.has(summary.role))
    .filter(summary => Number(summary.row_count || 0) === 0 || summary.status === 'schema_only')
    .map(summary => summary.role);

  const usable_source_ids = unique(sourceSnapshots
    .filter(snapshot => USABLE_SOURCE_STATUSES.has(sourceStatus(snapshot)) || sourceRows(snapshot) > 0)
    .map(sourceId));

  const blocked_source_ids = unique(sourceSnapshots
    .filter(snapshot => BLOCKED_SOURCE_STATUSES.has(sourceStatus(snapshot)))
    .map(sourceId));

  return {
    tableSummaries,
    sourceSnapshots,
    p0_gap_roles,
    usable_source_ids,
    blocked_source_ids,
    next_management_actions: unique([
      ...gapActions(p0_gap_roles),
      ...sourceActions(sourceSnapshots),
      '守门规则保持不变：路线统计不提升证据，能力雷达不提升证据，D1 必须有交易证据。',
    ]),
  };
}

export function renderDataFrameworkReport({ date, model }) {
  const tableRows = (model.tableSummaries || []).map(summary => [
    summary.path,
    summary.role || summary.layer || '',
    summary.row_count,
    summary.status,
    summary.management_action,
  ]);
  const sourceRowsForReport = (model.sourceSnapshots || []).map(snapshot => [
    sourceId(snapshot),
    sourceStatus(snapshot),
    sourceRows(snapshot),
    snapshot.note || snapshot.reason || '',
  ]);
  const gaps = model.p0_gap_roles?.length ? model.p0_gap_roles.join(', ') : '无';
  const usable = model.usable_source_ids?.length ? model.usable_source_ids.join(', ') : '无';
  const blocked = model.blocked_source_ids?.length ? model.blocked_source_ids.join(', ') : '无';
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- 暂无';

  return `# Goods Radar 数据体系管理报告

日期：${date}

## 1. 数据表覆盖情况

${mdTable(['表', '角色', '行数', '状态', '管理动作'], tableRows)}

## 2. P0 数据闭环缺口

- 缺口角色：${gaps}
- 解释：P0 闭环要求供应商主档、当前批次证据、报价/QC、本地核实任务、试加工/试柜复盘互相连接。

## 3. 数据源快照

${mdTable(['数据源', '状态', '行数', '说明'], sourceRowsForReport)}

- 可用数据源：${usable}
- 需处理数据源：${blocked}

## 4. Top 管理动作

${actions}

## 5. 硬守门提醒

- 公共路线统计只影响 route_feasibility，永不提升 evidence_level。
- 能力雷达事实只影响 radar_score、priority_grade 和寻源理由。
- D1 需要提单、贸易、发票或成熟交易证据。
`;
}
