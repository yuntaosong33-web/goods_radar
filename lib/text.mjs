export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function compactSpaces(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeCompanyName(name) {
  const original = compactSpaces(name);
  if (!original) return '';

  const stripped = original
    .replace(/\b(S\.?A\.?|S\/A|S\.?R\.?L\.?|Ltda\.?|Limitada|LLC|Inc\.?|Corp\.?|Corporation|Co\.?|Company)\b/gi, '')
    .replace(/[.,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return stripped || original;
}

export function slugify(value) {
  return normalizeText(value)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function companyKey(name, country = '') {
  const base = normalizeText(normalizeCompanyName(name))
    .replace(/\b(sa|srl|ltda|limitada|llc|inc|corp|corporation|company|co)\b/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const countryKey = normalizeText(country).replace(/[^a-z0-9]+/g, '');
  return `${countryKey}:${base}`;
}

export function includesTerm(text, term) {
  const normalizedText = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  return normalizedText.includes(normalizedTerm);
}

export function findTerms(text, terms = []) {
  const seen = new Set();
  const found = [];
  for (const term of terms) {
    if (!term) continue;
    if (includesTerm(text, term)) {
      const key = normalizeText(term);
      if (!seen.has(key)) {
        seen.add(key);
        found.push(term);
      }
    }
  }
  return found;
}

export function splitList(value) {
  return String(value ?? '')
    .split(/[;,，、|]/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function levelNumber(level, prefix) {
  const match = String(level ?? '').trim().match(new RegExp(`^${prefix}(\\d)$`, 'i'));
  return match ? Number(match[1]) : 0;
}

export function clamp(number, min, max) {
  return Math.max(min, Math.min(max, number));
}
