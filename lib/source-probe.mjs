const USABLE_STATUSES = new Set(['collected', 'usable']);
const BLOCKED_STATUSES = new Set([
  'auth_required',
  'blocked',
  'blocked_or_unavailable',
  'error',
  'manual_required',
  'no_structured_rows',
]);

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sourceId(row) {
  return row.source_id || row.id || row.url || '';
}

function sourceStatus(row) {
  return String(row.status || '').trim();
}

function rowCount(row) {
  return number(row.row_count ?? row.lead_count ?? row.route_count ?? row.rows);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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

function sourceSnapshots({ leadHistory, routeHistory, radarResult }) {
  return [
    ...(leadHistory || []).map(row => ({
      layer: 'lead_collection',
      source_id: sourceId(row),
      status: sourceStatus(row),
      row_count: rowCount(row),
      reason: row.reason || '',
    })),
    ...(routeHistory || []).map(row => ({
      layer: 'route_signal',
      source_id: sourceId(row),
      status: sourceStatus(row),
      row_count: rowCount(row),
      reason: row.reason || '',
    })),
    ...((radarResult?.health || []).map(row => ({
      layer: row.layer || 'capability_radar',
      source_id: sourceId(row),
      status: sourceStatus(row),
      row_count: rowCount(row),
      reason: row.reason || row.retrieval || '',
    }))),
  ];
}

function managementActions({ counts, snapshots, blockedSourceIds }) {
  const actions = [];
  if (counts.leads > 0) {
    actions.push('审核暂存线索行；只有具备官方身份和来源追溯的行，才可进入 scan/import 评审。');
  }
  if (counts.routes > 0) {
    actions.push('暂存路线行保持 route_signal_only；仅用于路线可行性，不用于证据升级。');
  }
  if (counts.capabilities + counts.capacities + counts.approvals > 0) {
    actions.push('暂存能力行仅用于 radar_score、priority_grade 和核实理由。');
  }
  if (blockedSourceIds.length) {
    actions.push(`检查受阻数据源的访问或解析状态：${blockedSourceIds.join(', ')}。`);
  }
  if (snapshots.some(row => sourceStatus(row) === 'auth_required')) {
    actions.push('仅当数据源值得进入日常运营时，再配置所需 API 凭证。');
  }
  actions.push('暂存行在人工或受控导入器批准前不得写入 data/*。');
  actions.push('D1 仍需提单、发票、贸易或成熟交易证据。');
  return unique(actions);
}

export function buildSourceProbeModel({
  leadRows = [],
  leadHistory = [],
  routeRows = [],
  routeHistory = [],
  radarResult = {},
  stagingPaths = {},
} = {}) {
  const snapshots = sourceSnapshots({ leadHistory, routeHistory, radarResult });
  const usable_source_ids = unique(snapshots
    .filter(row => USABLE_STATUSES.has(sourceStatus(row)) || rowCount(row) > 0)
    .map(sourceId));
  const blocked_source_ids = unique(snapshots
    .filter(row => BLOCKED_STATUSES.has(sourceStatus(row)))
    .map(sourceId));
  const counts = {
    leads: leadRows.length,
    routes: routeRows.length,
    capabilities: radarResult.capabilities?.length || 0,
    capacities: radarResult.capacities?.length || 0,
    approvals: radarResult.approvals?.length || 0,
  };

  return {
    write_scope: 'reports_only',
    stagingPaths,
    counts,
    sourceSnapshots: snapshots,
    usable_source_ids,
    blocked_source_ids,
    next_management_actions: managementActions({ counts, snapshots, blockedSourceIds: blocked_source_ids }),
  };
}

export function renderSourceProbeReport({ date, model }) {
  const sourceRows = (model.sourceSnapshots || []).map(row => [
    row.layer,
    row.source_id,
    row.status,
    row.row_count,
    row.reason,
  ]);
  const stagingRows = Object.entries(model.stagingPaths || {}).map(([name, path]) => [name, path]);
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- 暂无';
  const usable = model.usable_source_ids?.length ? model.usable_source_ids.join(', ') : '无';
  const blocked = model.blocked_source_ids?.length ? model.blocked_source_ids.join(', ') : '无';

  return `# Goods Radar 数据源探测报告

日期：${date}

写入范围：${model.write_scope}

## 1. 统计概览

| 对象 | 行数 |
| --- | --- |
| 暂存线索 | ${model.counts?.leads || 0} |
| 暂存路线信号 | ${model.counts?.routes || 0} |
| 暂存能力事实 | ${model.counts?.capabilities || 0} |
| 暂存产能事实 | ${model.counts?.capacities || 0} |
| 暂存出口批准事实 | ${model.counts?.approvals || 0} |

## 2. 数据源状态

${mdTable(['层级', '数据源', '状态', '行数', '原因'], sourceRows)}

- 可用数据源：${usable}
- 受阻数据源：${blocked}

## 3. Staging 输出

${mdTable(['名称', '路径'], stagingRows)}

## 4. 管理动作

${actions}

## 5. 硬守门规则

- 路线统计不提升证据。
- 能力雷达事实不提升证据。
- D1 需要提单、发票、贸易或成熟交易证据。
`;
}
