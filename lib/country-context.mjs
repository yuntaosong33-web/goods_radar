import { COUNTRY_CONTEXT_HEADERS } from './constants.mjs';
import { slugify, todayIso } from './text.mjs';

export const TARGET_COUNTRIES = [
  { country: 'Brazil', countryCode: 'BRA' },
  { country: 'Paraguay', countryCode: 'PRY' },
  { country: 'Uruguay', countryCode: 'URY' },
  { country: 'Argentina', countryCode: 'ARG' },
  { country: 'Chile', countryCode: 'CHL' },
  { country: 'Colombia', countryCode: 'COL' },
];

export const WORLD_BANK_INDICATORS = [
  { indicatorId: 'AG.PRD.LVSK.XD', label: 'Livestock production index (2014-2016 = 100)' },
  { indicatorId: 'AG.PRD.FOOD.XD', label: 'Food production index (2014-2016 = 100)' },
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

export function buildWorldBankIndicatorUrl({ countryCode, indicatorId, perPage = 8 }) {
  return `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorId}?format=json&per_page=${perPage}`;
}

export function normalizeWorldBankIndicatorRows({
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
    context_id: `world_bank-${slugify(countryCode)}-${slugify(indicatorId)}-${period}`,
    source_id: 'world_bank',
    country: clean(latest.country?.value || countryCode),
    country_code: clean(countryCode),
    indicator_id: indicatorId,
    indicator_name: clean(latest.indicator?.value),
    period,
    value: clean(latest.value),
    unit: clean(latest.unit),
    source_url: sourceUrl,
    status: 'macro_context_only',
    collected_at: collectedAt,
    notes: '国家宏观背景仅用于排序解释，不提升供应商证据。',
  }];
}

async function fetchWorldBankJson(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'goods-radar/0.1 (+country context research)',
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

export async function collectWorldBankCountryContext({
  countries = TARGET_COUNTRIES,
  indicators = WORLD_BANK_INDICATORS,
  fetchImpl = globalThis.fetch,
  collectedAt = todayIso(),
  perPage = 8,
} = {}) {
  const rows = [];
  const history = [];
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available in this Node runtime');

  for (const country of countries) {
    for (const indicator of indicators) {
      const url = buildWorldBankIndicatorUrl({
        countryCode: country.countryCode,
        indicatorId: indicator.indicatorId,
        perPage,
      });
      try {
        const json = await fetchWorldBankJson(url, fetchImpl);
        const normalized = normalizeWorldBankIndicatorRows({
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

export function buildCountryContextModel({ rows = [], history = [] } = {}) {
  const blocked = history.filter(row => ['error'].includes(row.status));
  return {
    write_scope: 'reports_only',
    context_scope: 'country_macro_context',
    counts: {
      context_rows: rows.length,
      countries: unique(rows.map(row => row.country_code)).length,
      indicators: unique(rows.map(row => row.indicator_id)).length,
      blocked_sources: blocked.length,
    },
    rows,
    history,
    next_management_actions: [
      rows.length
        ? '使用国家宏观背景比较国家供给基础，并辅助安排人工触达顺序。'
        : '暂无国家宏观背景行；请重试数据源或选择其他宏观数据源。',
      blocked.length
        ? `检查受阻国家背景源：${blocked.map(row => row.source_id).join('、')}。`
        : '未发现国家背景源阻塞。',
      '国家背景行仅作为宏观背景，永远不提升供应商证据。',
    ],
  };
}

export function renderCountryContextReport({ date, model }) {
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

  return `# Goods Radar 国家宏观背景

日期：${date}

写入范围：${model.write_scope}

背景范围：${model.context_scope}

## 1. 统计概览

| 指标 | 数量 |
| --- | --- |
| 背景行 | ${model.counts.context_rows} |
| 国家数 | ${model.counts.countries} |
| 指标数 | ${model.counts.indicators} |
| 受阻源 | ${model.counts.blocked_sources} |

## 2. World Bank 国家背景

${mdTable(['国家', '代码', '指标', '名称', '年份', '数值', '状态'], contextRows)}

## 3. 数据源状态

${mdTable(['数据源', '状态', '行数', '原因'], historyRows)}

## 4. 管理动作

${actions}

## 5. 硬守门规则

- 国家宏观背景只用于宏观判断。
- 国家宏观背景可以丰富优先级和开发理由。
- 国家宏观背景不提升供应商证据。
- D1 必须有提单、发票、贸易或成熟交易证据。
`;
}

export function emptyCountryContextRows() {
  return Object.fromEntries(COUNTRY_CONTEXT_HEADERS.map(header => [header, '']));
}
