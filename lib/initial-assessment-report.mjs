function clean(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

function translateDecision(decision) {
  if (decision === 'official_source_verify_product_scope') return '官方来源候选，需核实产品范围';
  if (decision === 'p0_contact_ready') return '可进入 P0 联系与取证';
  if (decision === 'field_verification_candidate') return '可安排本地核实';
  if (decision === 'watchlist_requires_more_signal') return '观察名单，需更多信号';
  return decision || '待判断';
}

function translateNextAction(action) {
  const text = clean(action);
  if (/current omasum\/librillo\/folhoso video/i.test(text)) {
    return '索取当前批次 omasum/librillo/folhoso 视频、周供货量、加工方式和出口联系人。';
  }
  if (/local verifier/i.test(text)) {
    return '安排本地核实，确认源头身份、百叶/叶胃处理能力和冷链路径。';
  }
  if (/quote/i.test(text)) {
    return '进入 P0 联系任务，索取报价、当前批次资料和加工细节。';
  }
  return text || '补充产品范围、当前批次证据、联系人和报价。';
}

function topRows(rows, limit = 10) {
  return [...(rows || [])]
    .sort((a, b) => (
      number(b.rule_score) + number(b.radar_score) + number(b.country_context_score) + number(b.logistics_context_score)
    ) - (
      number(a.rule_score) + number(a.radar_score) + number(a.country_context_score) + number(a.logistics_context_score)
    ))
    .slice(0, limit);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildInitialAssessmentModel({
  sourceEvaluationRows = [],
  countryContextRows = [],
  logisticsContextRows = [],
  sourceProbeModel = {},
  limit = 10,
} = {}) {
  const candidates = topRows(sourceEvaluationRows, limit);
  const p0Ready = candidates.filter(row => row.preliminary_decision === 'p0_contact_ready').length;
  const productScope = candidates.filter(row => row.preliminary_decision === 'official_source_verify_product_scope').length;
  return {
    write_scope: 'reports_only',
    counts: {
      evaluated_suppliers: sourceEvaluationRows.length,
      reported_candidates: candidates.length,
      p0_ready: p0Ready,
      product_scope_verification: productScope,
      country_context_rows: countryContextRows.length,
      logistics_context_rows: logisticsContextRows.length,
      staged_leads: number(sourceProbeModel.counts?.leads),
      staged_routes: number(sourceProbeModel.counts?.routes),
      staged_capabilities: number(sourceProbeModel.counts?.capabilities),
    },
    usable_source_ids: sourceProbeModel.usable_source_ids || unique(sourceEvaluationRows.map(row => row.real_source_id)),
    blocked_source_ids: sourceProbeModel.blocked_source_ids || [],
    candidates,
    countryContextRows,
    logisticsContextRows,
    management_actions: [
      '优先联系官方来源候选供应商，先核实是否有当前批次 omasum/librillo/folhoso。',
      '每个候选必须补齐联系人、当前批次证据、报价/QC 和本地核实任务，才能进入真实开发闭环。',
      '路线统计、能力雷达、国家宏观背景和物流背景都只能辅助排序，不能提升证据等级。',
      'D1 必须有提单、发票、贸易或成熟交易证据。',
    ],
  };
}

export function renderInitialAssessmentReport({ date, model }) {
  const candidateRows = (model.candidates || []).map(row => [
    row.normalized_company_name,
    row.country,
    row.real_source_id,
    row.official_registration,
    `${row.omasum_level}/${row.evidence_level}/${row.development_distance}`,
    row.rule_score,
    row.radar_score,
    row.country_context_score || '0',
    row.logistics_context_score || '0',
    translateDecision(row.preliminary_decision),
    translateNextAction(row.next_action),
  ]);
  const countryRows = (model.countryContextRows || []).slice(0, 12).map(row => [
    row.country,
    row.indicator_id,
    row.period,
    row.value,
  ]);
  const logisticsRows = (model.logisticsContextRows || []).slice(0, 12).map(row => [
    row.country,
    row.indicator_id,
    row.period,
    row.value,
  ]);
  const actions = (model.management_actions || []).map(action => `- ${action}`).join('\n') || '- 暂无';

  return `# Goods Radar 初始供应商评估报告

评估日期：${date}

写入范围：${model.write_scope}

## 1. 核心结论

- 本次初评供应商：${model.counts.evaluated_suppliers} 个。
- 报告展示候选：${model.counts.reported_candidates} 个。
- 需要核实产品范围的官方来源候选：${model.counts.product_scope_verification} 个。
- 可直接进入 P0 联系与取证的候选：${model.counts.p0_ready} 个。
- 当前结论：公开真实来源已经能支持供应商初筛，但仍不能替代当前批次证据、联系人、报价/QC、本地核实和试柜复盘。

## 2. 真实数据源接入结果

| 数据层 | 行数/状态 | 管理含义 |
| --- | --- | --- |
| 供应商线索 | ${model.counts.staged_leads} | 来自官方/公开来源的候选池 |
| 路线统计 | ${model.counts.staged_routes} | 只用于路线可行性，不提升证据 |
| 能力雷达 | ${model.counts.staged_capabilities} | 只用于 radar_score、priority_grade 和核实理由 |
| 国家宏观背景 | ${model.counts.country_context_rows} | 只用于国家供给背景和排序解释 |
| 物流背景 | ${model.counts.logistics_context_rows} | 只用于路线与开发优先级解释 |

- 可用数据源：${model.usable_source_ids.length ? model.usable_source_ids.join('、') : '暂无'}
- 需处理数据源：${model.blocked_source_ids.length ? model.blocked_source_ids.join('、') : '暂无'}

## 3. 初评候选供应商

${mdTable(['供应商', '国家', '来源', '注册/编号', 'O/E/D', '规则分', '雷达分', '国家背景', '物流背景', '初步判断', '下一步动作'], candidateRows)}

## 4. 国家与物流背景

### 国家宏观背景

${mdTable(['国家', '指标', '年份', '数值'], countryRows)}

### 物流背景

${mdTable(['国家', '指标', '年份', '数值'], logisticsRows)}

## 5. 管理动作

${actions}

## 6. 硬守门规则

- 路线统计不提升证据。
- 能力雷达不提升证据。
- 国家宏观背景不提升证据。
- 物流背景不提升证据。
- D1 必须有提单、发票、贸易或成熟交易证据。
`;
}
