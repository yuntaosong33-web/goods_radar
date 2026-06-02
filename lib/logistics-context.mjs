import { LOGISTICS_CONTEXT_HEADERS } from './constants.mjs';
import { slugify, todayIso } from './text.mjs';

export const TARGET_LOGISTICS_COUNTRIES = [
  { country: 'Brazil', countryCode: 'BRA' },
  { country: 'Paraguay', countryCode: 'PRY' },
  { country: 'Uruguay', countryCode: 'URY' },
  { country: 'Argentina', countryCode: 'ARG' },
  { country: 'Chile', countryCode: 'CHL' },
  { country: 'Colombia', countryCode: 'COL' },
];

export const WORLD_BANK_LOGISTICS_INDICATORS = [
  { indicatorId: 'LP.LPI.OVRL.XQ', label: 'Logistics performance index: Overall' },
  { indicatorId: 'IS.SHP.GOOD.TU', label: 'Container port traffic (TEU)' },
];

function clean(value) {
  return String(value ?? '').trim();
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

export function buildWorldBankLogisticsUrl({ countryCode, indicatorId, perPage = 12 }) {
  return `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorId}?format=json&per_page=${perPage}`;
}

export function normalizeWorldBankLogisticsRows({
  countryCode,
  sourceUrl,
  data = [],
  collectedAt = todayIso(),
}) {
  const latest = (Array.isArray(data) ? data : [])
    .filter(row => row && row.value !== null && row.value !== undefined && row.value !== '')
    .sort((a, b) => Number(b.date || 0) - Number(a.date || 0))[0];
  if (!latest) return [];

  const indicatorId = clean(latest.indicator?.id);
  const period = clean(latest.date);
  return [{
    logistics_id: `world_bank-${slugify(countryCode)}-${slugify(indicatorId)}-${period}`,
    source_id: 'world_bank',
    country: clean(latest.country?.value || countryCode),
    country_code: clean(countryCode),
    indicator_id: indicatorId,
    indicator_name: clean(latest.indicator?.value),
    period,
    value: clean(latest.value),
    unit: clean(latest.unit),
    source_url: sourceUrl,
    status: 'logistics_context_only',
    collected_at: collectedAt,
    notes: '物流背景仅用于路线与开发优先级解释，不提升供应商证据。',
  }];
}

async function fetchWorldBankJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'goods-radar/0.1 (+logistics context research)',
    },
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response: HTTP ${response.status}`);
  }
  if (!response.ok) {
    const message = Array.isArray(json) ? json[0]?.message?.[0]?.value : json.message;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return json;
}

export async function collectWorldBankLogisticsContext({
  countries = TARGET_LOGISTICS_COUNTRIES,
  indicators = WORLD_BANK_LOGISTICS_INDICATORS,
  fetchImpl = globalThis.fetch,
  collectedAt = todayIso(),
  perPage = 12,
} = {}) {
  const rows = [];
  const history = [];
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available in this Node runtime');

  for (const country of countries) {
    for (const indicator of indicators) {
      const url = buildWorldBankLogisticsUrl({
        countryCode: country.countryCode,
        indicatorId: indicator.indicatorId,
        perPage,
      });
      try {
        const json = await fetchWorldBankJson(url, fetchImpl);
        const normalized = normalizeWorldBankLogisticsRows({
          countryCode: country.countryCode,
          sourceUrl: url,
          data: Array.isArray(json) ? json[1] || [] : [],
          collectedAt,
        }).map(row => ({
          ...row,
          country: country.country || row.country,
          indicator_name: row.indicator_name || indicator.label,
        }));
        rows.push(...normalized);
        history.push({
          source_id: `world_bank-${country.countryCode}-${indicator.indicatorId}`,
          status: normalized.length ? 'collected' : 'no_rows',
          row_count: String(normalized.length),
          reason: normalized.length ? 'OK' : 'World Bank returned no non-null value in requested page',
          source_url: url,
        });
      } catch (err) {
        history.push({
          source_id: `world_bank-${country.countryCode}-${indicator.indicatorId}`,
          status: 'error',
          row_count: '0',
          reason: err.message,
          source_url: url,
        });
      }
    }
  }

  return { rows, history };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildLogisticsContextModel({ rows = [], history = [] } = {}) {
  const blocked = history.filter(row => row.status === 'error');
  return {
    write_scope: 'reports_only',
    context_scope: 'logistics_macro_context',
    counts: {
      logistics_rows: rows.length,
      countries: unique(rows.map(row => row.country_code)).length,
      indicators: unique(rows.map(row => row.indicator_id)).length,
      blocked_sources: blocked.length,
    },
    rows,
    history,
    next_management_actions: [
      rows.length
        ? '使用物流背景比较出口处理能力基础，并辅助路线可行性检查。'
        : '暂无物流背景行；请重试数据源或选择其他物流数据源。',
      blocked.length
        ? `检查受阻物流背景源：${blocked.map(row => row.source_id).join('、')}。`
        : '未发现物流背景源阻塞。',
      '物流背景行仅作为宏观背景，永远不提升供应商证据。',
    ],
  };
}

export function renderLogisticsContextReport({ date, model }) {
  const contextRows = (model.rows || []).map(row => [
    row.country,
    row.country_code,
    row.indicator_id,
    row.indicator_name,
    row.period,
    row.value,
    row.status,
  ]);
  const historyRows = (model.history || []).map(row => [
    row.source_id,
    row.status,
    row.row_count,
    row.reason,
  ]);
  const actions = (model.next_management_actions || []).map(action => `- ${action}`).join('\n') || '- None';

  return `# Goods Radar 物流背景

日期：${date}

写入范围：${model.write_scope}

背景范围：${model.context_scope}

## 1. 统计概览

| 指标 | 数量 |
| --- | --- |
| 物流背景行 | ${model.counts.logistics_rows} |
| 国家数 | ${model.counts.countries} |
| 指标数 | ${model.counts.indicators} |
| 受阻源 | ${model.counts.blocked_sources} |

## 2. World Bank 物流背景

${mdTable(['国家', '代码', '指标', '名称', '年份', '数值', '状态'], contextRows)}

## 3. 数据源状态

${mdTable(['数据源', '状态', '行数', '原因'], historyRows)}

## 4. 管理动作

${actions}

## 5. 硬守门规则

- 物流背景只用于宏观判断。
- 物流背景可以丰富路线可行性和触达顺序。
- 物流背景不提升供应商证据。
- D1 必须有提单、发票、贸易或成熟交易证据。
`;
}

export function emptyLogisticsContextRows() {
  return Object.fromEntries(LOGISTICS_CONTEXT_HEADERS.map(header => [header, '']));
}
