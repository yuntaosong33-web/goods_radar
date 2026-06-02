import { readFileSync } from 'fs';
import { BILL_OF_LADING_HEADERS, COMPANY_HEADERS, EVIDENCE_HEADERS } from './constants.mjs';
import { parseCsv } from './csv.mjs';
import { appendTsvRows, readTsv } from './tsv.mjs';
import { companyKey, normalizeCompanyName, slugify, todayIso } from './text.mjs';
import { rowsFromXlsxBuffer } from './xlsx-lite.mjs';

function first(record, names) {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== '') return String(record[name]).trim();
  }
  return '';
}

function normalizeHs(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

function shipmentId(record) {
  const bill = record.bill_of_lading_no || record.bill_no || '';
  const key = bill || `${record.shipper}-${record.shipment_date}-${record.product_description}`;
  return `bol-${slugify(key)}`;
}

export function billRowsFromRecords(records, sourceFile) {
  const rows = [];
  for (const record of records) {
    const normalized = {
      source_file: sourceFile,
      source_platform: first(record, ['Source Platform', 'source_platform', 'Platform', 'platform']) || 'paid_customs_export',
      shipment_date: first(record, ['Date', 'Shipment Date', 'shipment_date', 'date']),
      shipper: first(record, ['Shipper', 'shipper', 'Exporter', 'exporter', 'Supplier', 'supplier']),
      shipper_country: first(record, ['Shipper Country', 'shipper_country', 'Origin Country', 'origin_country', 'Country', 'country']),
      consignee: first(record, ['Consignee', 'consignee', 'Buyer', 'buyer', 'Importer', 'importer']),
      destination_country: first(record, ['Destination Country', 'destination_country', 'Partner Country', 'partner_country']),
      destination_port: first(record, ['Port', 'Destination Port', 'destination_port', 'port']),
      hs_code: normalizeHs(first(record, ['HS Code', 'hs_code', 'HS', 'NCM', 'ncm'])),
      product_description: first(record, ['Product Description', 'product_description', 'Description', 'description', 'Goods', 'goods']),
      quantity_kg: first(record, ['Net Weight KG', 'quantity_kg', 'Weight KG', 'net_weight_kg', 'KG']),
      container_count: first(record, ['Containers', 'container_count', 'Container Count']),
      bill_of_lading_no: first(record, ['B/L No', 'Bill of Lading', 'bill_of_lading_no', 'BL No', 'bl_no']),
      source_url_or_file: first(record, ['Source URL', 'source_url_or_file', 'Source File', 'Source']) || sourceFile,
    };

    if (!normalized.shipper || !normalized.product_description || !(normalized.bill_of_lading_no || normalized.shipment_date)) continue;
    rows.push({
      shipment_id: shipmentId(normalized),
      ...normalized,
      evidence_level: 'E2',
      development_distance: 'D1',
      notes: '付费/明细海关数据导入；提单明细才可作为供应商证据',
    });
  }
  return rows;
}

export function parseBillCsv(text, sourceFile) {
  return billRowsFromRecords(parseCsv(text), sourceFile);
}

export function evidenceFromBillRows(rows) {
  return rows.map(row => {
    const normalized = normalizeCompanyName(row.shipper);
    return {
      evidence_id: row.shipment_id,
      company_key: companyKey(normalized, row.shipper_country),
      normalized_company_name: normalized,
      evidence_type: 'bill_of_lading',
      date_received: row.shipment_date || todayIso(),
      path_or_url: row.source_url_or_file,
      summary: `${row.product_description}; HS ${row.hs_code}; ${row.quantity_kg || 'unknown'} kg; ${row.destination_port || row.destination_country}; B/L ${row.bill_of_lading_no}`,
      is_current_batch: 'false',
      omasum_level: '',
      risk_points: '',
      human_review: '',
      evidence_level: 'E2',
    };
  });
}

export function companiesFromBillRows(rows) {
  return rows.map(row => {
    const normalized = normalizeCompanyName(row.shipper);
    return {
      ...Object.fromEntries(COMPANY_HEADERS.map(header => [header, ''])),
      source_id: `bol-${slugify(row.bill_of_lading_no || row.shipment_id)}`,
      raw_company_name: row.shipper,
      normalized_company_name: normalized,
      country: row.shipper_country,
      company_type: 'exporter',
      source_type: 'bill_of_lading',
      url_or_file: row.source_url_or_file,
      official_registration: row.bill_of_lading_no,
      omasum_level: '',
      evidence_level: 'E2',
      development_distance: 'D1',
      route_feasibility: 'high',
      notes: `${row.product_description}; destination ${row.destination_port || row.destination_country}; HS ${row.hs_code}; B/L ${row.bill_of_lading_no}`,
      updated_at: todayIso(),
    };
  });
}

function existingKeys(path, keyField) {
  const { rows } = readTsv(path);
  return new Set(rows.map(row => row[keyField]).filter(Boolean));
}

export function writeBillImport({ rows, billPath = 'data/bill-of-lading.tsv', evidencePath = 'data/evidence.tsv', companyPath = 'data/companies.tsv' }) {
  const existingShipments = existingKeys(billPath, 'shipment_id');
  const newBills = rows.filter(row => !existingShipments.has(row.shipment_id));
  appendTsvRows(billPath, BILL_OF_LADING_HEADERS, newBills);

  const existingEvidence = existingKeys(evidencePath, 'evidence_id');
  const evidenceRows = evidenceFromBillRows(newBills).filter(row => !existingEvidence.has(row.evidence_id));
  appendTsvRows(evidencePath, EVIDENCE_HEADERS, evidenceRows);

  const { rows: companies } = readTsv(companyPath, COMPANY_HEADERS);
  const companyKeys = new Set(companies.map(row => companyKey(row.normalized_company_name || row.raw_company_name, row.country)));
  const newCompanies = companiesFromBillRows(newBills).filter(row => {
    const key = companyKey(row.normalized_company_name || row.raw_company_name, row.country);
    if (companyKeys.has(key)) return false;
    companyKeys.add(key);
    return true;
  });
  appendTsvRows(companyPath, COMPANY_HEADERS, newCompanies);

  return { bills: newBills.length, evidence: evidenceRows.length, companies: newCompanies.length };
}

export function readBillFile(path) {
  if (/\.csv$/i.test(path)) return parseBillCsv(readFileSync(path, 'utf8'), path);
  if (/\.xlsx$/i.test(path)) return billRowsFromRecords(rowsFromXlsxBuffer(readFileSync(path)), path);
  throw new Error('不支持的提单导入文件。请使用 CSV 或 XLSX。');
}
