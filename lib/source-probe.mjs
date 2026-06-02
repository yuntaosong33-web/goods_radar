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
    actions.push('Review staged lead rows, then run scan/import only for rows with official identity and provenance.');
  }
  if (counts.routes > 0) {
    actions.push('Keep staged route rows as route_signal_only; use them for route feasibility, not evidence upgrades.');
  }
  if (counts.capabilities + counts.capacities + counts.approvals > 0) {
    actions.push('Use staged capability rows only for radar_score, priority_grade, and verification rationale.');
  }
  if (blockedSourceIds.length) {
    actions.push(`Review blocked source access/parser status: ${blockedSourceIds.join(', ')}.`);
  }
  if (snapshots.some(row => sourceStatus(row) === 'auth_required')) {
    actions.push('Configure required API credentials only when the source is worth operationalizing.');
  }
  actions.push('Keep staged rows out of data/* until a human or guarded importer approves promotion.');
  actions.push('D1 still requires bill-of-lading, invoice, trade, or mature transaction evidence.');
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
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- None';
  const usable = model.usable_source_ids?.length ? model.usable_source_ids.join(', ') : 'None';
  const blocked = model.blocked_source_ids?.length ? model.blocked_source_ids.join(', ') : 'None';

  return `# Goods Radar Source Probe Report

Date: ${date}

Write scope: ${model.write_scope}

## Counts

| Object | Rows |
| --- | --- |
| Staged leads | ${model.counts?.leads || 0} |
| Staged route signals | ${model.counts?.routes || 0} |
| Staged capabilities | ${model.counts?.capabilities || 0} |
| Staged capacities | ${model.counts?.capacities || 0} |
| Staged approvals | ${model.counts?.approvals || 0} |

## Source Status

${mdTable(['Layer', 'Source', 'Status', 'Rows', 'Reason'], sourceRows)}

- Usable sources: ${usable}
- Blocked sources: ${blocked}

## Staging Outputs

${mdTable(['Name', 'Path'], stagingRows)}

## Management Actions

${actions}

## Guardrails

- Route statistics never upgrade evidence.
- Capability radar facts never upgrade evidence.
- D1 requires bill-of-lading, invoice, trade, or mature transaction evidence.
`;
}
