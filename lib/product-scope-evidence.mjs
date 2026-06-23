import { companyKey } from './text.mjs';

const SOCIAL_HOSTS = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'youtube.com',
  'wa.me',
  'whatsapp.com',
];
const BLOCKED_PATH_PATTERN = /(login|signin|sign-in|account|private|messages|inbox|dm|maps\/place|reviews)/i;
const PRODUCT_TERMS = [
  'omasum',
  'omaso',
  'librillo',
  'folhoso',
  'book tripe',
  'leaf tripe',
  'bovine omasum',
  'menudencia bovina',
  'menudencias bovinas',
  'menudencia bovino',
  'miudos bovinos',
  'miúdo bovino',
  'miúdos bovinos',
  'subproductos bovinos',
  'subprodutos bovinos',
];

const PRECISE_TERMS = [
  'omasum',
  'omaso',
  'librillo',
  'folhoso',
  'book tripe',
  'leaf tripe',
  'bovine omasum',
];

function normalizeUrl(value, baseUrl = '') {
  try {
    return new URL(String(value || ''), baseUrl || undefined).toString();
  } catch {
    return '';
  }
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isAllowedProductScopeUrl(value) {
  const url = normalizeUrl(value);
  if (!url) return false;
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) return false;
  const hostAndPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  if (SOCIAL_HOSTS.some(host => hostname === host || hostname.endsWith(`.${host}`))) return false;
  if (BLOCKED_PATH_PATTERN.test(hostAndPath)) return false;
  return true;
}

function contextFor(html, term) {
  const compact = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const index = normalize(compact).indexOf(normalize(term));
  if (index < 0) return compact.slice(0, 180);
  return compact.slice(Math.max(0, index - 80), index + term.length + 100).trim();
}

function httpErrorMessage(response) {
  return `HTTP ${response.status || 0}${response.statusText ? ` ${response.statusText}` : ''}`.trim();
}

export function extractProductScopeRows({ company, pageUrl, html }) {
  const sourceUrl = normalizeUrl(pageUrl);
  const key = companyKey(company?.normalized_company_name || company?.raw_company_name, company?.country);
  const base = {
    company_key: key,
    source_id: company?.source_id || '',
    normalized_company_name: company?.normalized_company_name || company?.raw_company_name || '',
    country: company?.country || '',
    evidence_url: sourceUrl || String(pageUrl || ''),
    source_url: sourceUrl || String(pageUrl || ''),
  };
  if (!isAllowedProductScopeUrl(sourceUrl)) {
    return [{
      ...base,
      product_term: '',
      evidence_context: '',
      confidence: 'low',
      review_status: 'manual_required',
      notes: 'blocked source: only public company/catalog/product pages are allowed',
    }];
  }

  const text = normalize(html);
  const found = PRODUCT_TERMS.filter(term => text.includes(normalize(term)));
  if (!found.length) {
    return [{
      ...base,
      product_term: '',
      evidence_context: contextFor(html, ''),
      confidence: 'low',
      review_status: 'manual_required',
      notes: 'no omasum/byproduct product-scope term extracted',
    }];
  }

  return found.map(term => ({
    ...base,
    product_term: term,
    evidence_context: contextFor(html, term),
    confidence: PRECISE_TERMS.includes(term) ? 'high' : 'medium',
    review_status: 'pending_review',
    notes: 'product-scope staging only; requires human review before evidence upgrade',
  }));
}

export async function collectProductScopeRows({
  companies = [],
  fetchImpl = globalThis.fetch,
  limit = Infinity,
} = {}) {
  const rows = [];
  const health = { attempted: 0, fetched: 0, blocked: 0, errors: 0 };
  for (const company of companies.slice(0, limit)) {
    const url = company.url_or_file;
    health.attempted += 1;
    if (!isAllowedProductScopeUrl(url)) {
      health.blocked += 1;
      rows.push(...extractProductScopeRows({ company, pageUrl: url, html: '' }));
      continue;
    }
    try {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(httpErrorMessage(response));
      const html = await response.text();
      health.fetched += 1;
      rows.push(...extractProductScopeRows({ company, pageUrl: url, html }));
    } catch (err) {
      health.errors += 1;
      rows.push({
        company_key: companyKey(company?.normalized_company_name || company?.raw_company_name, company?.country),
        source_id: company?.source_id || '',
        normalized_company_name: company?.normalized_company_name || company?.raw_company_name || '',
        country: company?.country || '',
        product_term: '',
        evidence_context: '',
        evidence_url: String(url || ''),
        confidence: 'low',
        source_url: String(url || ''),
        review_status: 'manual_required',
        notes: `fetch error: ${err.message}`,
      });
    }
  }
  return { rows, health };
}
