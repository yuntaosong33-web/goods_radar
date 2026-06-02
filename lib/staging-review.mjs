import { autoLeadProvenanceIssues } from './provenance.mjs';
import { companyKey, normalizeCompanyName } from './text.mjs';

const BLOCKED_SOURCE_STATUSES = new Set([
  'auth_required',
  'blocked',
  'blocked_or_unavailable',
  'error',
  'manual_required',
  'no_structured_rows',
]);

function clean(value) {
  return String(value ?? '').trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function sourceId(row) {
  return row.source_id || row.id || '';
}

function rowCount(row) {
  const number = Number(row.row_count ?? row.lead_count ?? row.route_count ?? row.rows ?? 0);
  return Number.isFinite(number) ? number : 0;
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildExistingIndex(companies) {
  const byCompanyKey = new Map();
  const byRegistration = new Map();
  const byUrl = new Map();

  for (const row of companies || []) {
    const label = row.source_id || row.normalized_company_name || row.raw_company_name || 'existing company';
    const key = companyKey(row.normalized_company_name || row.raw_company_name, row.country);
    if (key !== ':') byCompanyKey.set(key, label);
    if (clean(row.official_registration)) byRegistration.set(lower(row.official_registration), label);
    if (clean(row.url_or_file)) byUrl.set(clean(row.url_or_file), label);
  }

  return { byCompanyKey, byRegistration, byUrl };
}

function stagedLeadLabel(row) {
  return row.source_id || row.normalized_company_name || row.raw_company_name || 'staged lead';
}

function reviewLead(row, existing) {
  const normalizedName = normalizeCompanyName(row.normalized_company_name || row.raw_company_name);
  const key = companyKey(normalizedName || row.raw_company_name, row.country);
  const registration = lower(row.official_registration);
  const url = clean(row.url_or_file);
  const issues = [];
  const duplicateHits = [];

  if (!clean(row.raw_company_name) && !clean(row.normalized_company_name)) issues.push('missing company name');
  if (!clean(row.country)) issues.push('missing country');
  issues.push(...autoLeadProvenanceIssues(row));

  if (key !== ':' && existing.byCompanyKey.has(key)) duplicateHits.push(`company_key:${existing.byCompanyKey.get(key)}`);
  if (registration && existing.byRegistration.has(registration)) duplicateHits.push(`registration:${existing.byRegistration.get(registration)}`);
  if (url && existing.byUrl.has(url)) duplicateHits.push(`url:${existing.byUrl.get(url)}`);

  let decision = 'promote_candidate';
  if (duplicateHits.length) decision = 'duplicate';
  else if (issues.length) decision = 'needs_fix';

  return {
    source_id: stagedLeadLabel(row),
    normalized_company_name: normalizedName || clean(row.raw_company_name),
    country: clean(row.country),
    official_registration: clean(row.official_registration),
    source_type: clean(row.source_type),
    decision,
    reasons: [...duplicateHits, ...issues],
    next_action: decision === 'promote_candidate'
      ? '可进入受控 scan/import 评审'
      : decision === 'duplicate'
        ? '不得晋级；如有价值可关联到现有供应商主档'
        : '晋级前先修复来源追溯/来源字段',
  };
}

function capabilityKey(row) {
  return companyKey(row.legal_name || row.plant_name || row.normalized_company_name, row.country);
}

function reviewCapability(row, existing) {
  const registration = lower(row.official_registration);
  const key = capabilityKey(row);
  const matchedByRegistration = registration && existing.byRegistration.has(registration);
  const matchedByCompanyKey = key !== ':' && existing.byCompanyKey.has(key);
  const decision = matchedByRegistration || matchedByCompanyKey ? 'matched_existing_company' : 'unmatched_capability';
  return {
    capability_id: row.capability_id || row.official_registration || row.legal_name || 'staged capability',
    legal_name: clean(row.legal_name || row.plant_name || row.normalized_company_name),
    country: clean(row.country),
    official_registration: clean(row.official_registration),
    decision,
    reasons: [
      matchedByRegistration ? `registration:${existing.byRegistration.get(registration)}` : '',
      matchedByCompanyKey ? `company_key:${existing.byCompanyKey.get(key)}` : '',
    ].filter(Boolean),
  };
}

function sourceBlockers(sourceSnapshots) {
  return unique((sourceSnapshots || [])
    .filter(row => BLOCKED_SOURCE_STATUSES.has(clean(row.status)))
    .map(row => sourceId(row)));
}

function nextActions({ counts, blockedSources, stagedRoutes }) {
  const actions = [];
  if (counts.promote_candidates) {
    actions.push(`仅通过受控 scan/import 评审处理 ${counts.promote_candidates} 个暂存线索晋级候选。`);
  }
  if (counts.duplicates) {
    actions.push(`将 ${counts.duplicates} 个重复暂存线索排除在供应商主档之外；必要时仅作为来源旁证备注。`);
  }
  if (counts.needs_fix) {
    actions.push(`修复 ${counts.needs_fix} 个缺少来源追溯、注册号或来源 URL 的暂存线索后，才允许考虑晋级。`);
  }
  if (counts.unmatched_capabilities) {
    actions.push(`审阅 ${counts.unmatched_capabilities} 个未匹配能力行，判断其是供应商主档候选还是仅作为能力事实。`);
  }
  if ((stagedRoutes || []).length) {
    actions.push('暂存路线行保持 route_signal_only；它们只支持路线可行性，不支持证据升级。');
  }
  if (blockedSources.length) {
    actions.push(`处理或明确暂缓受阻数据源：${blockedSources.join(', ')}。`);
  }
  actions.push('本次审核不得写入 data/*；晋级仍是独立的受控步骤。');
  return unique(actions);
}

export function buildStagingReviewModel({
  companies = [],
  stagedLeads = [],
  stagedCapabilities = [],
  stagedRoutes = [],
  sourceSnapshots = [],
} = {}) {
  const existing = buildExistingIndex(companies);
  const leadReviews = (stagedLeads || []).map(row => reviewLead(row, existing));
  const capabilityReviews = (stagedCapabilities || []).map(row => reviewCapability(row, existing));
  const blockedSources = sourceBlockers(sourceSnapshots);
  const counts = {
    staged_leads: leadReviews.length,
    promote_candidates: leadReviews.filter(row => row.decision === 'promote_candidate').length,
    duplicates: leadReviews.filter(row => row.decision === 'duplicate').length,
    needs_fix: leadReviews.filter(row => row.decision === 'needs_fix').length,
    staged_capabilities: capabilityReviews.length,
    matched_capabilities: capabilityReviews.filter(row => row.decision === 'matched_existing_company').length,
    unmatched_capabilities: capabilityReviews.filter(row => row.decision === 'unmatched_capability').length,
    staged_routes: stagedRoutes.length,
    blocked_sources: blockedSources.length,
  };

  return {
    write_scope: 'reports_only',
    counts,
    leadReviews,
    capabilityReviews,
    routeSummary: {
      row_count: stagedRoutes.length,
      route_sources: unique((stagedRoutes || []).map(row => row.source)),
      route_strengths: unique((stagedRoutes || []).map(row => row.route_strength)),
    },
    sourceSnapshots: (sourceSnapshots || []).map(row => ({
      source_id: sourceId(row),
      status: clean(row.status),
      row_count: rowCount(row),
      reason: row.reason || row.retrieval || '',
    })),
    blocked_source_ids: blockedSources,
    next_management_actions: nextActions({ counts, blockedSources, stagedRoutes }),
  };
}

export function renderStagingReviewReport({ date, model }) {
  const leadRows = (model.leadReviews || []).map(row => [
    row.source_id,
    row.normalized_company_name,
    row.country,
    row.official_registration,
    row.decision,
    row.reasons.join('; '),
    row.next_action,
  ]);
  const capabilityRows = (model.capabilityReviews || []).map(row => [
    row.capability_id,
    row.legal_name,
    row.country,
    row.official_registration,
    row.decision,
    row.reasons.join('; '),
  ]);
  const sourceRows = (model.sourceSnapshots || []).map(row => [
    row.source_id,
    row.status,
    row.row_count,
    row.reason,
  ]);
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- 暂无';
  const routeSources = model.routeSummary?.route_sources?.length ? model.routeSummary.route_sources.join(', ') : '无';
  const routeStrengths = model.routeSummary?.route_strengths?.length ? model.routeSummary.route_strengths.join(', ') : '无';

  return `# Goods Radar 暂存数据审核

日期：${date}

写入范围：${model.write_scope}

## 1. 决策统计

| 决策 | 行数 |
| --- | --- |
| 晋级候选 | ${model.counts.promote_candidates} |
| 重复线索 | ${model.counts.duplicates} |
| 需修复线索 | ${model.counts.needs_fix} |
| 已匹配能力事实 | ${model.counts.matched_capabilities} |
| 未匹配能力事实 | ${model.counts.unmatched_capabilities} |
| 暂存路线 | ${model.counts.staged_routes} |
| 受阻数据源 | ${model.counts.blocked_sources} |

## 2. 线索晋级审核

${mdTable(['来源 ID', '公司', '国家', '注册号', '决策', '原因', '下一步'], leadRows)}

## 3. 能力事实匹配审核

${mdTable(['能力 ID', '公司', '国家', '注册号', '决策', '原因'], capabilityRows)}

## 4. 路线信号审核

- 暂存路线行保持 route_signal_only：${model.routeSummary?.row_count || 0}
- 路线来源：${routeSources}
- 路线强度：${routeStrengths}

## 5. 数据源阻塞

${mdTable(['数据源', '状态', '行数', '原因'], sourceRows)}

## 6. 管理动作

${actions}

## 7. 硬守门规则

- 暂存审核不得写入 data/*。
- 暂存路线行只是 route_signal_only，永不提升证据。
- 暂存能力行只能在受控晋级后影响 radar_score、priority_grade 或核实理由。
- D1 需要提单、发票、贸易或成熟交易证据。
`;
}
