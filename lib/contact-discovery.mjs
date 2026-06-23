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
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4}/g;
const CONTACT_LINK_PATTERN = /href=["']([^"']*(?:contact|contacto|contato|sales|ventas|export)[^"']*)["']/gi;

function normalizeUrl(value, baseUrl = '') {
  try {
    return new URL(String(value || ''), baseUrl || undefined).toString();
  } catch {
    return '';
  }
}

export function isAllowedContactUrl(value) {
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractEmails(html) {
  return unique(String(html || '').match(EMAIL_PATTERN) || []);
}

function extractPhones(html) {
  return unique((String(html || '').match(PHONE_PATTERN) || [])
    .map(value => value.replace(/\s+/g, ' ').trim())
    .filter(value => /\d{7,}/.test(value.replace(/\D/g, ''))));
}

function extractContactPages(html, pageUrl) {
  const pages = [];
  for (const match of String(html || '').matchAll(CONTACT_LINK_PATTERN)) {
    const url = normalizeUrl(match[1], pageUrl);
    if (isAllowedContactUrl(url)) pages.push(url);
  }
  return unique(pages);
}

function confidenceFor({ emails, phones, contactPages }) {
  if (emails.length || phones.length || contactPages.length) return 'medium';
  return 'low';
}

function httpErrorMessage(response) {
  return `HTTP ${response.status || 0}${response.statusText ? ` ${response.statusText}` : ''}`.trim();
}

export function discoverContactsFromPage({
  company,
  sourceId = 'public_contact',
  pageUrl,
  html,
}) {
  const sourceUrl = normalizeUrl(pageUrl);
  if (!isAllowedContactUrl(sourceUrl)) {
    return [{
      company_key: companyKey(company?.normalized_company_name || company?.raw_company_name, company?.country),
      source_id: sourceId,
      normalized_company_name: company?.normalized_company_name || company?.raw_company_name || '',
      country: company?.country || '',
      contact_url: '',
      email: '',
      phone: '',
      contact_page: '',
      confidence: 'low',
      source_url: sourceUrl || String(pageUrl || ''),
      review_status: 'manual_required',
      notes: 'blocked source: only public company/official contact pages are allowed',
    }];
  }

  const emails = extractEmails(html);
  const phones = extractPhones(html);
  const contactPages = extractContactPages(html, sourceUrl);
  return [{
    company_key: companyKey(company?.normalized_company_name || company?.raw_company_name, company?.country),
    source_id: sourceId,
    normalized_company_name: company?.normalized_company_name || company?.raw_company_name || '',
    country: company?.country || '',
    contact_url: contactPages[0] || sourceUrl,
    email: emails[0] || '',
    phone: phones[0] || '',
    contact_page: contactPages[0] || '',
    confidence: confidenceFor({ emails, phones, contactPages }),
    source_url: sourceUrl,
    review_status: emails.length || phones.length || contactPages.length ? 'pending_review' : 'manual_required',
    notes: emails.length || phones.length || contactPages.length
      ? 'public contact staging only; requires guarded review before data/contacts.tsv import'
      : 'no public contact channel extracted',
  }];
}

export async function collectContactRows({
  companies = [],
  fetchImpl = globalThis.fetch,
  sourceId = 'public_contact',
  limit = Infinity,
} = {}) {
  const rows = [];
  const health = { attempted: 0, fetched: 0, blocked: 0, errors: 0 };
  for (const company of companies.slice(0, limit)) {
    const url = company.url_or_file;
    health.attempted += 1;
    if (!isAllowedContactUrl(url)) {
      health.blocked += 1;
      rows.push(...discoverContactsFromPage({ company, sourceId, pageUrl: url, html: '' }));
      continue;
    }
    try {
      const response = await fetchImpl(url);
      if (!response.ok) throw new Error(httpErrorMessage(response));
      const html = await response.text();
      health.fetched += 1;
      rows.push(...discoverContactsFromPage({ company, sourceId, pageUrl: url, html }));
    } catch (err) {
      health.errors += 1;
      rows.push({
        company_key: companyKey(company?.normalized_company_name || company?.raw_company_name, company?.country),
        source_id: sourceId,
        normalized_company_name: company?.normalized_company_name || company?.raw_company_name || '',
        country: company?.country || '',
        contact_url: '',
        email: '',
        phone: '',
        contact_page: '',
        confidence: 'low',
        source_url: String(url || ''),
        review_status: 'manual_required',
        notes: `fetch error: ${err.message}`,
      });
    }
  }
  return { rows, health };
}
