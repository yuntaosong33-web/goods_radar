import { slugify } from './text.mjs';

function approved(row) {
  return ['approved', 'verified'].includes(String(row.review_status || '').toLowerCase());
}

function channelKey(row) {
  return [
    String(row.company_key || '').toLowerCase(),
    String(row.email || '').toLowerCase(),
    String(row.phone || row.whatsapp || '').replace(/\D/g, ''),
  ].join('|');
}

export function buildContactImportRows({
  stagedRows = [],
  existingRows = [],
  importedAt,
} = {}) {
  const seen = new Set(existingRows.map(channelKey));
  const rows = [];
  for (const row of stagedRows) {
    if (!approved(row)) continue;
    if (!row.email && !row.phone && !row.contact_url && !row.contact_page) continue;
    const key = channelKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      contact_id: `contact-${slugify(row.company_key || row.normalized_company_name)}-${importedAt}`,
      company_key: row.company_key || '',
      normalized_company_name: row.normalized_company_name || '',
      contact_name: '',
      role: 'export/byproduct contact - verify',
      whatsapp: row.phone || '',
      email: row.email || '',
      language: '',
      relationship_source: row.contact_page || row.source_url || row.contact_url || '',
      trust_level: 'public_approved',
      last_summary: 'Imported from reviewed public contact staging.',
      next_questions: 'Confirm role, product scope, current omasum batch video, quote, QC, and export path.',
    });
  }
  return rows;
}
