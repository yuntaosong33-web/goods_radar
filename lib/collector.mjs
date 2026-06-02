import { appendTsvRows, writeTsv } from './tsv.mjs';
import { AUTO_LEAD_HEADERS, COLLECTION_HISTORY_HEADERS } from './constants.mjs';
import { detectKeywords } from './scoring.mjs';
import { compactSpaces, normalizeCompanyName, normalizeText, slugify, todayIso } from './text.mjs';

const SOURCE_GROUPS = [
  ['official_sources', 'official_list'],
  ['trade_data_sources', 'trade_data'],
  ['weak_signal_sources', 'weak_signal'],
];

const CAPACITY_TERMS = [
  'frigorifico',
  'frigorífico',
  'matadero',
  'abatedouro',
  'slaughter',
  'abattoir',
  'meat exporter',
  'exportador',
  'exporter',
  'cold storage',
  'subproductos',
  'subprodutos',
  'byproduct',
  'offal',
  'desposte',
  'graxaria',
  'rendering',
];

const TRADE_TERMS = [
  'hs 0504',
  '050400',
  '05040000',
  'bill of lading',
  'shipment',
  'customs',
  'import',
  'export',
  'hong kong',
  'vietnam',
  'hai phong',
];

const ENTITY_MAP = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const NOISE_NAME_PATTERNS = [
  /^ir al contenido principal$/i,
  /^menu de navegacion$/i,
  /^menú de navegación$/i,
  /^institucional$/i,
  /^plan estrategico$/i,
  /^direcciones generales$/i,
  /^productos de origen animal$/i,
  /^servicios tecnicos$/i,
  /^laboratorios$/i,
  /^transparencia$/i,
  /^sala de prensa$/i,
  /^recursos para medios$/i,
  /^uruguayan meat exporters$/i,
  /^uruguay meat exporters( companies)?$/i,
  /^lista de frigorificos habilitados/i,
  /^lista de frigoríficos habilitados/i,
  /^bee products and byproducts;?$/i,
];

export function sourceConfigsFrom(sources) {
  const configs = [];
  for (const [group, defaultType] of SOURCE_GROUPS) {
    const entries = Array.isArray(sources?.[group]) ? sources[group] : [];
    for (const entry of entries) {
      if (entry.enabled === false || !entry.url) continue;
      configs.push({
        ...entry,
        group,
        source_type: entry.type || defaultType,
      });
    }
  }
  return configs;
}

function decodeHtmlEntities(text) {
  return String(text ?? '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
    return ENTITY_MAP[lower] ?? match;
  });
}

function stripHtml(text) {
  return compactSpaces(decodeHtmlEntities(String(text ?? '').replace(/<[^>]+>/g, ' ')));
}

function absoluteUrl(url, baseUrl) {
  try {
    return new URL(decodeHtmlEntities(url), baseUrl).toString();
  } catch {
    return decodeHtmlEntities(url);
  }
}

function htmlLinksFrom(html, baseUrl) {
  return [...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match => ({
    url: absoluteUrl(match[1], baseUrl),
    label: stripHtml(match[2]),
  }));
}

export function extractOfficialDataLinks({ sourceUrl, html }) {
  const links = [];
  const seen = new Set();
  for (const link of htmlLinksFrom(html, sourceUrl)) {
    const sheetMatch = link.url.match(/docs\.google\.com\/spreadsheets\/d\/([^/?#]+)/i);
    if (sheetMatch) {
      const url = `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`;
      if (!seen.has(url)) {
        seen.add(url);
        links.push({ type: 'google_sheet_csv', url, label: link.label });
      }
      continue;
    }
    if (/\.(csv|tsv|xlsx?)(\?|#|$)/i.test(link.url) && !seen.has(link.url)) {
      seen.add(link.url);
      links.push({ type: 'file', url: link.url, label: link.label });
    }
  }
  return links;
}

function htmlToText(text) {
  return decodeHtmlEntities(String(text ?? ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '\n')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '\n')
    .replace(/<\/?(p|div|li|tr|td|th|br|h[1-6]|section|article|table|ul|ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '\n');
}

function textBlocksFrom(text) {
  const blocks = [];
  const seen = new Set();
  for (const rawLine of htmlToText(text).split(/\n+/)) {
    const block = compactSpaces(rawLine);
    if (block.length < 12 || block.length > 500) continue;
    const key = normalizeText(block);
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(block);
  }
  return blocks;
}

function hasAnyTerm(text, terms) {
  const normalized = normalizeText(text);
  return terms.some(term => normalized.includes(normalizeText(term)));
}

function hashText(text) {
  let hash = 2166136261;
  for (const char of String(text ?? '')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function sourceLeadId(source, name, extra = '') {
  const hash = hashText(`${source.id}|${source.url}|${name}|${extra}`).slice(0, 8);
  return `auto-${slugify(source.id || source.label || 'source')}-${slugify(normalizeCompanyName(name) || name)}-${hash}`;
}

function inferCompanyType(text) {
  const normalized = normalizeText(text);
  if (/frigorifico|frogorifico|\bfrigo|slaughter|matadero|abatedouro|abattoir/.test(normalized)) return 'frigorifico';
  if (/cold storage|frigorifico/.test(normalized)) return 'cold_storage';
  if (/byproduct|subproducto|subproduto|offal|graxaria|rendering|processor/.test(normalized)) return 'byproduct_processor';
  if (/exporter|exportador|exportadora|meat export|meat|foods|packers|minerva|marfrig/.test(normalized)) return 'exporter';
  if (/trader|broker|trading/.test(normalized)) return 'trader';
  return 'unknown';
}

function extractRegistration(text) {
  const match = String(text ?? '').match(/\b(SIF|SENACSA|INAC|SENASA|DIPOA)[\s:/#-]*([A-Z0-9.-]{2,})\b/i);
  return match ? `${match[1].toUpperCase()}-${match[2].toUpperCase()}` : '';
}

function hasCompanySuffix(name) {
  return /\b(S\.?\s*A\.?|S\/A|S\.?\s*R\.?\s*L\.?|Ltda\.?|Limitada|LLC|Inc\.?|Corp\.?|Cooperativa)\b/i.test(name);
}

function isNoiseName(name) {
  const normalized = normalizeText(name).replace(/\s+/g, ' ').trim();
  return !normalized || NOISE_NAME_PATTERNS.some(pattern => pattern.test(normalized));
}

function isUsableGenericLead(row) {
  if (isNoiseName(row.raw_company_name)) return false;
  if (row.official_registration) return true;
  if (hasCompanySuffix(row.raw_company_name)) return true;
  if (/(frigorifico|frigorífico|matadero|abatedouro|slaughter|abattoir)/i.test(row.raw_company_name)) return true;
  return false;
}

function extractCompanyName(block, source) {
  const cleaned = compactSpaces(block).replace(/^[-*•]+\s*/, '');
  const firstSegment = compactSpaces(cleaned.split(/\s+(?:-|–|—|\|)\s+|:\s+/)[0]);
  const suffixMatch = cleaned.match(/([A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜáéíóúñü0-9&.,'()/-]+(?:\s+[A-Za-zÁÉÍÓÚÑÜáéíóúñü0-9&.,'()/-]+){0,8}\s+(?:S\.?\s*A\.?|S\/A|S\.?\s*R\.?\s*L\.?|Ltda\.?|Limitada|LLC|Inc\.?|Corp\.?))/);
  const candidate = suffixMatch?.[1] || firstSegment;
  if (candidate && candidate.length <= 120 && /[A-Za-zÁÉÍÓÚÑÜáéíóúñü]/.test(candidate)) return candidate;
  return source.label || source.id || 'unknown source';
}

function isRelevantBlock(block, source, mission) {
  const row = {
    source_type: source.source_type,
    description: block,
    notes: '',
  };
  const keywords = detectKeywords(row, mission);
  if (keywords.precise.length || keywords.broad.length) return { relevant: true, keywords };
  if (source.source_type === 'trade_data' && hasAnyTerm(block, TRADE_TERMS)) return { relevant: true, keywords };
  if (['official_list', 'weak_signal'].includes(source.source_type) && hasAnyTerm(block, CAPACITY_TERMS)) {
    return { relevant: true, keywords };
  }
  return { relevant: false, keywords };
}

export function extractLeadRows({ source, text, mission, limit = 50 }) {
  const rows = [];
  for (const block of textBlocksFrom(text)) {
    if (rows.length >= limit) break;
    const { relevant, keywords } = isRelevantBlock(block, source, mission);
    if (!relevant) continue;

    const name = extractCompanyName(block, source);
    const normalizedName = normalizeCompanyName(name);
    const hash = hashText(`${source.id}|${source.url}|${block}`).slice(0, 8);
    const terms = [...keywords.precise, ...keywords.broad].join(';');
    const row = {
      source_id: sourceLeadId(source, normalizedName || name, hash),
      raw_company_name: name,
      country: source.country || '',
      city: '',
      company_type: inferCompanyType(`${name} ${block}`),
      source_type: source.source_type,
      url_or_file: `${source.url}#auto-${hash}`,
      official_registration: extractRegistration(block),
      description: block,
      notes: [
        `自动采集：${source.label || source.id}`,
        source.purpose ? `用途：${source.purpose}` : '',
        terms ? `命中：${terms}` : '',
      ].filter(Boolean).join('；'),
    };
    if (isUsableGenericLead(row)) rows.push(row);
  }
  return rows;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map(header => compactSpaces(header));
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, compactSpaces(values[index] ?? '')])));
}

function addSetValue(map, key, value) {
  if (!value) return;
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function normalizedRegistrationKey(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function processorNameScore(name) {
  let score = 0;
  if (/frigorifico/i.test(name)) score += 20;
  if (/frogorifico/i.test(name)) score -= 10;
  if (hasCompanySuffix(name)) score += 10;
  if (/\b(matadero|cooperativa|foods|packers)\b/i.test(name)) score += 5;
  score += Math.min(name.length, 80) / 10;
  return score;
}

export function parseSenacsaCsvRows({ source, csv, originUrl, limit = 50 }) {
  const parsed = parseCsv(csv);
  const byProcessor = new Map();
  let currentMercaderia = '';
  let currentClass = '';
  let currentCountry = '';

  for (const row of parsed) {
    const mercaderia = row.Mercaderia || row.mercaderia;
    const classification = row['Clasificacion Destino'] || row['Clasificación Destino'] || '';
    const country = row['Pais Destino'] || row['País Destino'] || '';
    const registration = row['N° Registro Oficial'] || row['N Registro Oficial'] || row.Registro || '';
    const processor = row['Establecimiento Procesador'] || row.Establecimiento || '';

    if (mercaderia) currentMercaderia = mercaderia;
    if (classification) currentClass = classification;
    if (country && !/^total\b/i.test(country)) currentCountry = country;
    if (!registration || !processor || /^total\b/i.test(country)) continue;

    const name = compactSpaces(processor);
    const key = normalizedRegistrationKey(registration);
    if (!byProcessor.has(key)) {
      byProcessor.set(key, {
        name,
        registration,
        nameScore: processorNameScore(name),
        mercaderias: new Set(),
        classes: new Set(),
        countries: new Set(),
      });
    }
    const entry = byProcessor.get(key);
    const score = processorNameScore(name);
    if (score > entry.nameScore) {
      entry.name = name;
      entry.registration = registration;
      entry.nameScore = score;
    }
    if (currentMercaderia) entry.mercaderias.add(currentMercaderia);
    if (currentClass) entry.classes.add(currentClass);
    if (currentCountry) entry.countries.add(currentCountry);
  }

  return [...byProcessor.values()].slice(0, limit).map(entry => {
    const mercaderias = [...entry.mercaderias].slice(0, 5).join(', ');
    const destinations = [...entry.countries].slice(0, 8).join(', ');
    const classes = [...entry.classes].slice(0, 4).join(', ');
    const officialRegistration = `SENACSA-${entry.registration}`;
    const inferredType = inferCompanyType(entry.name);
    return {
      source_id: sourceLeadId(source, entry.name, officialRegistration),
      raw_company_name: entry.name,
      country: source.country || 'Paraguay',
      city: '',
      company_type: inferredType === 'unknown' ? 'frigorifico' : inferredType,
      source_type: source.source_type,
      url_or_file: `${originUrl || source.url}#registro-${officialRegistration}`,
      official_registration: officialRegistration,
      description: [
        mercaderias ? `Mercaderia: ${mercaderias}` : '',
        classes ? `Clasificacion destino: ${classes}` : '',
        destinations ? `Pais destino: ${destinations}` : '',
      ].filter(Boolean).join('; '),
      notes: `自动采集：${source.label || source.id}；结构化解析：SENACSA Google Sheets；官方注册号：${officialRegistration}`,
    };
  });
}

export function parseUruguayExporterRows({ source, text, limit = 50 }) {
  const rows = [];
  const html = String(text ?? '');
  const markers = [...html.matchAll(/<p[^>]*>\s*No\.\s*([\s\S]*?)<\/p>/gi)];
  for (const [index, marker] of markers.entries()) {
    if (rows.length >= limit) break;
    const number = stripHtml(marker[1]);
    const nextIndex = markers[index + 1]?.index ?? marker.index + 3500;
    const chunk = html.slice(marker.index, nextIndex);
    const titleMatch = chunk.match(/<h2[^>]*class=["'][^"']*product_title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i);
    const linkMatch = chunk.match(/<a[^>]+href=["']([^"']*\/product\/[^"']*)["'][^>]*>/i);
    const name = stripHtml(titleMatch?.[1] || '');
    if (!number || !name || isNoiseName(name)) continue;
    const url = absoluteUrl(linkMatch?.[1] || source.url, source.url);
    const officialRegistration = `INAC-${number.replace(/\s*&\s*/g, '-').replace(/\s*,\s*/g, '-').replace(/[^0-9A-Za-z-]+/g, '').replace(/-+/g, '-')}`;
    rows.push({
      source_id: sourceLeadId(source, name, officialRegistration),
      raw_company_name: name,
      country: source.country || 'Uruguay',
      city: '',
      company_type: inferCompanyType(name),
      source_type: source.source_type,
      url_or_file: url,
      official_registration: officialRegistration,
      description: `Uruguay Meats exporter card No. ${number}: ${name}`,
      notes: `自动采集：${source.label || source.id}；结构化解析：Uruguay Meats exporter card；官方编号：${officialRegistration}`,
    });
  }
  return rows;
}

async function specializedRowsForSource({ source, text, mission, fetchImpl, limit, timeoutMs }) {
  if (source.id === 'uruguay_meats_exporters' || /uymeats\.com\/exporters/i.test(source.url)) {
    return parseUruguayExporterRows({ source, text, limit });
  }

  if (source.id === 'paraguay_senacsa_frigorificos' || /senacsa\.gov\.py/i.test(source.url)) {
    const links = extractOfficialDataLinks({ sourceUrl: source.url, html: text });
    const sheet = links.find(link => link.type === 'google_sheet_csv');
    if (sheet) {
      const csv = await fetchSourceText({ ...source, url: sheet.url }, fetchImpl, timeoutMs);
      return parseSenacsaCsvRows({ source, csv, originUrl: sheet.url, limit });
    }
  }

  if (source.id === 'brazil_mapa_dipoa' || /gov\.br\/agricultura/i.test(source.url)) {
    return [];
  }

  return null;
}

async function fetchSourceText(source, fetchImpl, timeoutMs) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl(source.url, {
      headers: {
        accept: 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'goods-radar/0.1 (+local sourcing research)',
      },
      signal: controller?.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ''}`.trim());
    return await response.text();
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function retryableFetchError(error) {
  const text = String(error?.message || '');
  return /aborted|timeout|network|fetch failed|HTTP 408|HTTP 409|HTTP 425|HTTP 429|HTTP 5\d\d/i.test(text);
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchSourceTextWithRetry(source, fetchImpl, timeoutMs, retries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchSourceText(source, fetchImpl, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt >= retries || !retryableFetchError(err)) break;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

export async function collectFromSource({
  source,
  mission,
  fetchImpl = globalThis.fetch,
  limit = 50,
  timeoutMs = 15000,
}) {
  const collectedAt = todayIso();
  try {
    if (typeof fetchImpl !== 'function') throw new Error('fetch is not available in this Node runtime');
    const text = await fetchSourceTextWithRetry(source, fetchImpl, timeoutMs);
    const specialized = await specializedRowsForSource({ source, text, mission, fetchImpl, limit, timeoutMs });
    const rows = specialized ?? extractLeadRows({ source, text, mission, limit });
    return {
      source,
      rows,
      history: {
        source_id: source.id || source.label || source.url,
        collected_at: collectedAt,
        source_type: source.source_type,
        url: source.url,
        status: 'collected',
        lead_count: String(rows.length),
        reason: rows.length ? 'OK' : 'OK, no matching lead blocks',
      },
    };
  } catch (err) {
    return {
      source,
      rows: [],
      history: {
        source_id: source.id || source.label || source.url,
        collected_at: collectedAt,
        source_type: source.source_type,
        url: source.url,
        status: 'error',
        lead_count: '0',
        reason: err.message,
      },
    };
  }
}

export async function collectConfiguredSources({
  sources,
  mission,
  fetchImpl = globalThis.fetch,
  limit = 50,
  sourceId = null,
}) {
  const configs = sourceConfigsFrom(sources).filter(source => !sourceId || source.id === sourceId);
  const results = [];
  for (const source of configs) {
    results.push(await collectFromSource({ source, mission, fetchImpl, limit }));
  }
  return {
    results,
    rows: results.flatMap(result => result.rows),
    history: results.map(result => result.history),
  };
}

export function writeCollectionOutputs({
  rows,
  history,
  outputPath = 'data/auto-leads.tsv',
  historyPath = 'data/collection-history.tsv',
}) {
  writeTsv(outputPath, AUTO_LEAD_HEADERS, rows);
  appendTsvRows(historyPath, COLLECTION_HISTORY_HEADERS, history);
}
