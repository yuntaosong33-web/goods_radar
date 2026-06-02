import { companyKey, levelNumber, normalizeText, slugify, todayIso } from './text.mjs';

const BYPRODUCT_PATTERN = /menudencia|menudencias|miudos|miúdos|viscera|visceras|vísceras|bucho|librillo|omaso|folhoso|mondongo|subproductos|subprodutos|offal|byproduct/i;
const ASIA_PATTERN = /china|hong kong|vietnam|viet nam|taiwan|cambodia|thailand|singapore/i;
const HIGH_STANDARD_MARKET_PATTERN = /european union|union europea|eu|usa|united states|canada|chile|japan|korea|taiwan/i;

function cleanNumber(value) {
  const number = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function normalizedRegistration(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function normalizedName(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function rowMatchesCompany(row, company) {
  const companyRegistration = normalizedRegistration(company.official_registration);
  if (companyRegistration && normalizedRegistration(row.official_registration) === companyRegistration) return true;

  const rowName = normalizedName(row.legal_name || row.plant_name || row.shipper);
  const companyName = normalizedName(company.normalized_company_name || company.raw_company_name);
  return Boolean(rowName && companyName && rowName === companyName && normalizeText(row.country || row.shipper_country) === normalizeText(company.country));
}

function rowsForCompany(rows, company) {
  return (rows || []).filter(row => rowMatchesCompany(row, company));
}

function officialScore(capabilityRows, company) {
  if (capabilityRows.some(row => /active|habilitado|approved|operating/i.test(row.operational_status))) return 25;
  if (capabilityRows.length) return 20;
  if (company.official_registration) return 15;
  if (/official/i.test(company.source_type || '')) return 10;
  return 0;
}

function supplyScore(capacityRows) {
  const maxHeads = Math.max(0, ...capacityRows.map(row => cleanNumber(row.slaughter_head_count)));
  if (maxHeads >= 10000) return 25;
  if (maxHeads >= 3000) return 18;
  if (maxHeads > 0) return 12;
  return 0;
}

function byproductScore(capabilityRows, company) {
  const text = [
    company.keywords_found,
    company.notes,
    ...capabilityRows.map(row => `${row.product_scope} ${row.byproduct_signal} ${row.activity_type}`),
  ].join(' ');
  if (BYPRODUCT_PATTERN.test(text)) return 20;
  if (/frigorifico|slaughter|matadero|abatedouro|beneficio bovino/i.test(text)) return 8;
  return 0;
}

function exportReadinessScore(capabilityRows, approvalRows) {
  const approvalText = approvalRows.map(row => `${row.destination_market} ${row.product_category} ${row.approval_status}`).join(' ');
  const capabilityText = capabilityRows.map(row => `${row.export_markets} ${row.product_scope}`).join(' ');
  if (ASIA_PATTERN.test(`${approvalText} ${capabilityText}`)) return 15;
  if (HIGH_STANDARD_MARKET_PATTERN.test(`${approvalText} ${capabilityText}`)) return 12;
  if (approvalRows.length || /export|habilitados por pais importador|other markets/i.test(capabilityText)) return 8;
  return 0;
}

function billRowsForCompany(billRows, company) {
  const companyName = normalizedName(company.normalized_company_name || company.raw_company_name);
  const companyCountry = normalizeText(company.country);
  return (billRows || []).filter(row => {
    const shipperName = normalizedName(row.shipper);
    if (!shipperName || !companyName) return false;
    return shipperName === companyName && (!companyCountry || normalizeText(row.shipper_country) === companyCountry);
  });
}

function marketWhitespaceScore({ billRows, matchingBillRows, capabilityRows, approvalRows }) {
  if (!(billRows || []).length) return 0;
  if (matchingBillRows.length) return 2;
  if (capabilityRows.length || approvalRows.length) return 10;
  return 0;
}

function contactabilityScore(company, capabilityRows) {
  const text = [
    company.url_or_file,
    company.city,
    ...capabilityRows.map(row => `${row.source_url} ${row.address} ${row.city}`),
  ].join(' ');
  let score = 0;
  if (/https?:\/\//i.test(text)) score += 2;
  if (/\b[A-Za-z .-]+,\s*[A-Za-z .-]+/.test(text) || company.city) score += 2;
  if (capabilityRows.length) score += 2;
  if (capabilityRows.some(row => row.address || row.city) || company.official_registration) score += 1;
  return Math.min(5, score);
}

export function priorityGradeForScore(score) {
  const value = Number(score || 0);
  if (value >= 75) return 'A';
  if (value >= 60) return 'B';
  if (value >= 45) return 'C';
  if (value >= 30) return 'D';
  return 'E';
}

function refs(rows, field) {
  return rows.map(row => row[field]).filter(Boolean).join(';');
}

function recommendedVerification({ grade, byproduct, supply, exportReadiness }) {
  if (grade === 'A') return '联系工厂或本地核实人，索取当前 omasum/librillo 处理视频、周屠宰量和出口证书路径。';
  if (byproduct >= 20 && supply === 0) return '询问月屠宰量或收集量，并确认 omasum 是厂内处理还是由 triperia 处理。';
  if (supply > 0 && byproduct === 0) return '询问质量/出口联系人：menudencias/miudos/visceras 是否包含 omasum/librillo/folhoso。';
  if (exportReadiness === 0) return '确认出口证书经验、已批准市场和到港口的冷链路径。';
  return '保留在雷达中，继续核实官方状态、产品范围和联系人路径。';
}

function rationale({ capabilityRows, capacityRows, approvalRows, marketWhitespace, billRows }) {
  const parts = [];
  if (capabilityRows.length) parts.push('存在官方工厂能力事实');
  else parts.push('官方能力未知');
  if (capacityRows.length) parts.push('存在工厂级屠宰/产能信号');
  else parts.push('屠宰/产能未知');
  if (approvalRows.length) parts.push('存在出口批准/准备度信号');
  else parts.push('出口批准未知');
  if ((billRows || []).length && marketWhitespace >= 10) parts.push('已有贸易数据覆盖，但未找到匹配的成熟提单行');
  if (!(billRows || []).length) parts.push('因未加载提单数据集，市场空白仍未知');
  return parts.join('; ');
}

export function radarScoreForCompany({
  company,
  capabilities = [],
  capacities = [],
  approvals = [],
  billRows = [],
  scoredAt = todayIso(),
}) {
  const capabilityRows = rowsForCompany(capabilities, company);
  const capacityRows = rowsForCompany(capacities, company);
  const approvalRows = rowsForCompany(approvals, company);
  const matchingBillRows = billRowsForCompany(billRows, company);
  const official = officialScore(capabilityRows, company);
  const supply = supplyScore(capacityRows);
  const byproduct = byproductScore(capabilityRows, company);
  const exportReadiness = exportReadinessScore(capabilityRows, approvalRows);
  const marketWhitespace = marketWhitespaceScore({ billRows, matchingBillRows, capabilityRows, approvalRows });
  const contactability = contactabilityScore(company, capabilityRows);
  const total = official + supply + byproduct + exportReadiness + marketWhitespace + contactability;
  const grade = priorityGradeForScore(total);
  const key = companyKey(company.normalized_company_name || company.raw_company_name, company.country);

  return {
    radar_id: `radar-${slugify(company.source_id || key)}-${scoredAt}`,
    source_id: company.source_id,
    company_key: key,
    normalized_company_name: company.normalized_company_name || company.raw_company_name,
    country: company.country,
    official_score: String(official),
    supply_score: String(supply),
    byproduct_score: String(byproduct),
    export_readiness_score: String(exportReadiness),
    market_whitespace_score: String(marketWhitespace),
    contactability_score: String(contactability),
    radar_score: String(total),
    priority_grade: grade,
    invisible_supply_rationale: rationale({ capabilityRows, capacityRows, approvalRows, marketWhitespace, billRows }),
    recommended_verification: recommendedVerification({ grade, byproduct, supply, exportReadiness }),
    capability_refs: refs(capabilityRows, 'capability_id'),
    capacity_refs: refs(capacityRows, 'capacity_id'),
    approval_refs: refs(approvalRows, 'approval_id'),
    scored_at: scoredAt,
  };
}

export function buildRadarScores({
  companies = [],
  capabilities = [],
  capacities = [],
  approvals = [],
  billRows = [],
  scoredAt = todayIso(),
}) {
  const radarRows = companies.map(company => radarScoreForCompany({
    company,
    capabilities,
    capacities,
    approvals,
    billRows,
    scoredAt,
  }));
  const bySourceId = new Map(radarRows.map(row => [row.source_id, row]));
  const updatedCompanies = companies.map(company => {
    const radar = bySourceId.get(company.source_id);
    return radar ? {
      ...company,
      radar_score: radar.radar_score,
      priority_grade: radar.priority_grade,
      next_action: company.next_action || radar.recommended_verification,
    } : company;
  });
  return { companies: updatedCompanies, radarRows };
}
