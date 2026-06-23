import { appendTsvRows, writeTsv } from './tsv.mjs';
import { TRADE_ROUTE_HEADERS, TRADE_ROUTE_HISTORY_HEADERS } from './constants.mjs';
import { normalizeText, slugify, todayIso } from './text.mjs';

export const DEFAULT_ROUTE_PAIRS = [
  { reporter: 'Brazil', reporterCode: '76', partner: 'Viet Nam', partnerCode: '704' },
  { reporter: 'Brazil', reporterCode: '76', partner: 'Hong Kong', partnerCode: '344' },
  { reporter: 'Brazil', reporterCode: '76', partner: 'China', partnerCode: '156' },
  { reporter: 'Paraguay', reporterCode: '600', partner: 'Viet Nam', partnerCode: '704' },
  { reporter: 'Paraguay', reporterCode: '600', partner: 'Hong Kong', partnerCode: '344' },
  { reporter: 'Paraguay', reporterCode: '600', partner: 'China', partnerCode: '156' },
  { reporter: 'Uruguay', reporterCode: '858', partner: 'Viet Nam', partnerCode: '704' },
  { reporter: 'Uruguay', reporterCode: '858', partner: 'Hong Kong', partnerCode: '344' },
  { reporter: 'Uruguay', reporterCode: '858', partner: 'China', partnerCode: '156' },
  { reporter: 'Argentina', reporterCode: '32', partner: 'Viet Nam', partnerCode: '704' },
  { reporter: 'Argentina', reporterCode: '32', partner: 'Hong Kong', partnerCode: '344' },
  { reporter: 'Argentina', reporterCode: '32', partner: 'China', partnerCode: '156' },
  { reporter: 'Chile', reporterCode: '152', partner: 'Viet Nam', partnerCode: '704' },
  { reporter: 'Chile', reporterCode: '152', partner: 'Hong Kong', partnerCode: '344' },
  { reporter: 'Chile', reporterCode: '152', partner: 'China', partnerCode: '156' },
  { reporter: 'Colombia', reporterCode: '170', partner: 'Viet Nam', partnerCode: '704' },
  { reporter: 'Colombia', reporterCode: '170', partner: 'Hong Kong', partnerCode: '344' },
  { reporter: 'Colombia', reporterCode: '170', partner: 'China', partnerCode: '156' },
];

export const BRAZIL_COMEX_TARGETS = [
  { partner: 'Viet Nam', aliases: ['Vietnam'], comexCountryCode: '858' },
  { partner: 'Hong Kong', comexCountryCode: '351' },
  { partner: 'China', comexCountryCode: '160' },
];

export function buildComtradeUrl({ reporterCode, partnerCode, period, hsCode = '0504' }) {
  const params = new URLSearchParams({
    reporterCode: String(reporterCode),
    period: String(period),
    partnerCode: String(partnerCode),
    cmdCode: String(hsCode),
    flowCode: 'X',
    includeDesc: 'true',
  });
  return `https://comtradeapi.un.org/data/v1/get/C/A/HS?${params.toString()}`;
}

export function buildBrazilComexPayload({ period, hsCode = '0504', targets = BRAZIL_COMEX_TARGETS }) {
  return {
    flow: 'export',
    monthDetail: false,
    period: {
      from: `${period}-01`,
      to: `${period}-12`,
    },
    filters: [
      { filter: 'heading', values: [String(hsCode).slice(0, 4)] },
      { filter: 'country', values: targets.map(target => target.comexCountryCode) },
    ],
    details: ['country', 'heading'],
    metrics: ['metricFOB', 'metricKG'],
  };
}

export function routeStrength({ tradeValueUsd, netWeightKg }) {
  const value = Number(tradeValueUsd || 0);
  const weight = Number(netWeightKg || 0);
  if (value <= 0 && weight <= 0) return 'none';
  if (value >= 150000 || weight >= 30000) return 'strong';
  if (value >= 50000 || weight >= 10000) return 'medium';
  return 'weak';
}

export function routeFeasibilityForCompany(company, routes) {
  const country = normalizeText(company?.country);
  const strengths = new Set((routes || [])
    .filter(route => normalizeText(route.reporter) === country)
    .map(route => route.route_strength));
  if (strengths.has('strong')) return 'high';
  if (strengths.has('medium')) return 'medium';
  if (strengths.has('weak')) return 'low';
  return '';
}

function numericText(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number !== 0 ? String(number) : '';
}

export function normalizeComtradeRows({ source, sourceUrl, data }) {
  const collectedAt = todayIso();
  return (Array.isArray(data) ? data : []).map(row => {
    const reporter = row.reporterDesc || row.reporter || '';
    const partner = row.partnerDesc || row.partner || '';
    const hsCode = String(row.cmdCode || row.classificationCode || '0504');
    const period = String(row.period || row.refYear || '');
    const tradeValueUsd = numericText(row.primaryValue ?? row.tradeValue);
    const netWeightKg = numericText(row.netWgt ?? row.netWeight);
    return {
      route_id: `${source}-${slugify(reporter)}-${slugify(partner)}-${slugify(hsCode)}-${period}`,
      source,
      collected_at: collectedAt,
      reporter,
      reporter_code: String(row.reporterCode || ''),
      partner,
      partner_code: String(row.partnerCode || ''),
      hs_code: hsCode,
      period,
      flow: String(row.flowCode || 'X'),
      trade_value_usd: tradeValueUsd,
      net_weight_kg: netWeightKg,
      quantity: numericText(row.qty),
      route_strength: routeStrength({ tradeValueUsd, netWeightKg }),
      source_url: sourceUrl,
      status: 'route_signal_only',
      notes: '公开统计数据，只影响 route_feasibility，不提升 evidence_level',
    };
  });
}

export function normalizeBrazilComexRows({ sourceUrl, data, period, hsCode = '0504', targets = BRAZIL_COMEX_TARGETS }) {
  const collectedAt = todayIso();
  const targetByCountry = new Map();
  for (const target of targets) {
    targetByCountry.set(normalizeText(target.partner), target);
    for (const alias of target.aliases || []) targetByCountry.set(normalizeText(alias), target);
  }
  return (Array.isArray(data) ? data : []).map(row => {
    const partner = row.country || '';
    const target = targetByCountry.get(normalizeText(partner));
    const tradeValueUsd = numericText(row.metricFOB);
    const netWeightKg = numericText(row.metricKG);
    const routePeriod = String(row.year || period || '');
    const routeHs = String(row.headingCode || hsCode);
    return {
      route_id: `brazil_comex_stat-brazil-${slugify(partner)}-${slugify(routeHs)}-${routePeriod}`,
      source: 'brazil_comex_stat',
      collected_at: collectedAt,
      reporter: 'Brazil',
      reporter_code: '76',
      partner,
      partner_code: target?.comexCountryCode || '',
      hs_code: routeHs,
      period: routePeriod,
      flow: 'X',
      trade_value_usd: tradeValueUsd,
      net_weight_kg: netWeightKg,
      quantity: '',
      route_strength: routeStrength({ tradeValueUsd, netWeightKg }),
      source_url: sourceUrl,
      status: 'route_signal_only',
      notes: 'Public Comex Stat aggregate. Affects route_feasibility only; does not raise evidence_level.',
    };
  });
}

async function fetchJson(url, { fetchImpl, headers }) {
  const response = await fetchImpl(url, { headers });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response: HTTP ${response.status}`);
  }
  if (!response.ok) {
    const message = json.message || json.error || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return json;
}

function retryableFetchError(error) {
  const text = String(error?.message || '');
  return /aborted|timeout|network|fetch failed|HTTP 408|HTTP 409|HTTP 425|HTTP 429|HTTP 5\d\d|limite de solicita/i.test(text);
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, options, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson(url, options);
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !retryableFetchError(err)) break;
      await sleep(750 * (attempt + 1));
    }
  }
  throw lastError;
}

async function fetchBrazilComexJson({ sourceUrl, fetchImpl, period, hsCode, targets }) {
  const response = await fetchImpl(sourceUrl, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; goods-radar/0.1; local research)',
    },
    body: JSON.stringify(buildBrazilComexPayload({ period, hsCode, targets })),
  });
  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`non-JSON response: HTTP ${response.status}`);
  }
  if (!response.ok) {
    const message = json?.error?.message || json.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return json;
}

async function fetchBrazilComexJsonWithRetry(args, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchBrazilComexJson(args);
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !retryableFetchError(err)) break;
      await sleep(750 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function collectComtradeRoutes({
  routes = DEFAULT_ROUTE_PAIRS,
  period,
  hsCode = '0504',
  apiKey = process.env.COMTRADE_API_KEY || '',
  fetchImpl = globalThis.fetch,
}) {
  const history = [];
  const rows = [];
  if (!apiKey) {
    return {
      rows,
      history: [{
        source_id: 'un_comtrade',
        collected_at: todayIso(),
        status: 'auth_required',
        route_count: '0',
        reason: 'COMTRADE_API_KEY is required by the current UN Comtrade API',
      }],
    };
  }

  for (const route of routes) {
    const url = buildComtradeUrl({ ...route, period, hsCode });
    try {
      const json = await fetchJsonWithRetry(url, {
        fetchImpl,
        headers: {
          accept: 'application/json',
          'Ocp-Apim-Subscription-Key': apiKey,
          'user-agent': 'goods-radar/0.1',
        },
      });
      const data = json.data || json.dataset || [];
      const normalized = normalizeComtradeRows({ source: 'un_comtrade', sourceUrl: url, data });
      rows.push(...normalized);
      history.push({
        source_id: `un_comtrade-${route.reporterCode}-${route.partnerCode}`,
        collected_at: todayIso(),
        status: 'collected',
        route_count: String(normalized.length),
        reason: 'OK',
      });
    } catch (err) {
      history.push({
        source_id: `un_comtrade-${route.reporterCode}-${route.partnerCode}`,
        collected_at: todayIso(),
        status: 'error',
        route_count: '0',
        reason: err.message,
      });
    }
  }
  return { rows, history };
}

export async function collectBrazilComexRoutes({
  period,
  hsCode = '0504',
  targets = BRAZIL_COMEX_TARGETS,
  fetchImpl = globalThis.fetch,
} = {}) {
  const sourceUrl = 'https://api-comexstat.mdic.gov.br/general?language=en';
  try {
    const json = await fetchBrazilComexJsonWithRetry({ sourceUrl, fetchImpl, period, hsCode, targets });
    const rows = normalizeBrazilComexRows({
      sourceUrl,
      data: json?.data?.list || [],
      period,
      hsCode,
      targets,
    });
    return {
      rows,
      history: [{
        source_id: 'brazil_comex_stat',
        collected_at: todayIso(),
        status: rows.length ? 'collected' : 'no_rows',
        route_count: String(rows.length),
        reason: rows.length ? 'OK' : 'Comex Stat returned no route rows',
      }],
    };
  } catch (err) {
    return {
      rows: [],
      history: [{
        source_id: 'brazil_comex_stat',
        collected_at: todayIso(),
        status: 'blocked_or_unavailable',
        route_count: '0',
        reason: err.message,
      }],
    };
  }
}

export function writeTradeRouteOutputs({ rows, history, outputPath = 'data/trade-routes.tsv', historyPath = 'data/trade-route-history.tsv' }) {
  const hasAuthoritativeResult = history.some(item => item.status === 'collected' || item.status === 'no_rows');
  if (rows.length || hasAuthoritativeResult) {
    writeTsv(outputPath, TRADE_ROUTE_HEADERS, rows);
  }
  appendTsvRows(historyPath, TRADE_ROUTE_HISTORY_HEADERS, history);
}
