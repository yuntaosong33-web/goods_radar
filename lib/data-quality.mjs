function labelFor(row, fallback) {
  return row.contact_id || row.quote_id || row.trial_id || row.normalized_company_name || fallback;
}

function present(value) {
  return String(value ?? '').trim() !== '';
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function percentNumber(value) {
  if (!present(value)) return true;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100;
}

export function validateContactRows(rows = []) {
  const issues = [];
  for (const [index, row] of rows.entries()) {
    const label = labelFor(row, `contact row ${index + 2}`);
    if (!present(row.contact_id)) issues.push(`${label}: missing contact_id`);
    if (!present(row.company_key)) issues.push(`${label}: missing company_key`);
    if (!present(row.normalized_company_name)) issues.push(`${label}: missing normalized_company_name`);
    if (!present(row.whatsapp) && !present(row.email)) issues.push(`${label}: contact row needs whatsapp or email`);
  }
  return issues;
}

export function validateQuoteRows(rows = []) {
  const issues = [];
  for (const [index, row] of rows.entries()) {
    const label = labelFor(row, `quote row ${index + 2}`);
    if (!present(row.quote_id)) issues.push(`${label}: missing quote_id`);
    if (!present(row.company_key)) issues.push(`${label}: missing company_key`);
    if (!present(row.normalized_company_name)) issues.push(`${label}: missing normalized_company_name`);
    if (!present(row.product_original)) issues.push(`${label}: missing product_original`);
    if (!present(row.price)) issues.push(`${label}: quote row needs price`);
    if (!present(row.incoterm)) issues.push(`${label}: missing incoterm`);
    if (!present(row.quoted_at)) issues.push(`${label}: missing quoted_at`);
  }
  return issues;
}

export function validateTrialRows(rows = []) {
  const issues = [];
  for (const [index, row] of rows.entries()) {
    const label = labelFor(row, `trial row ${index + 2}`);
    if (!present(row.trial_id)) issues.push(`${label}: missing trial_id`);
    if (!present(row.company_key)) issues.push(`${label}: missing company_key`);
    if (!present(row.normalized_company_name)) issues.push(`${label}: missing normalized_company_name`);
    if (!present(row.country)) issues.push(`${label}: missing country`);
    if (!present(row.product)) issues.push(`${label}: missing product`);
    if (!positiveNumber(row.quantity_mt)) issues.push(`${label}: quantity_mt must be positive`);
    if (!percentNumber(row.actual_loss_percent)) issues.push(`${label}: actual_loss_percent must be 0-100 when provided`);
    if (!present(row.date)) issues.push(`${label}: missing date`);
  }
  return issues;
}
