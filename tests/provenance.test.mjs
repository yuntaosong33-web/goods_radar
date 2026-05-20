import assert from 'node:assert/strict';
import test from 'node:test';

import {
  autoLeadProvenanceIssues,
  sourceAvailabilityRows,
} from '../lib/provenance.mjs';

test('autoLeadProvenanceIssues accepts official rows with registration and concrete source URL', () => {
  const issues = autoLeadProvenanceIssues({
    source_id: 'auto-paraguay-senacsa-frigorifico-frigomerc',
    raw_company_name: 'FRIGORIFICO FRIGOMERC S.A.',
    source_type: 'official_list',
    url_or_file: 'https://docs.google.com/spreadsheets/d/sheet/export?format=csv#registro-SENACSA-2',
    official_registration: 'SENACSA-2',
    notes: '结构化解析：SENACSA Google Sheets',
  });

  assert.deepEqual(issues, []);
});

test('autoLeadProvenanceIssues rejects official rows without registration or source evidence', () => {
  const issues = autoLeadProvenanceIssues({
    source_id: 'auto-noisy',
    raw_company_name: 'Lista de frigoríficos habilitados por cada país habilitado',
    source_type: 'official_list',
    url_or_file: 'https://senacsa.gov.py/servicios/productos-de-origen-animal/lista-de-frigorificos-habilitados-por-cada-pais-habilitado/',
    official_registration: '',
    notes: '自动采集',
  });

  assert.deepEqual(issues, [
    'official_list row missing official_registration',
    'auto official row lacks structured parsing note',
  ]);
});

test('autoLeadProvenanceIssues rejects placeholders and non-http source paths', () => {
  const issues = autoLeadProvenanceIssues({
    source_id: 'auto-placeholder',
    raw_company_name: 'Placeholder Ltda',
    source_type: 'official_list',
    url_or_file: 'https://example.local/placeholder',
    official_registration: 'SENACSA-999',
    notes: '结构化解析：test',
  });

  assert.deepEqual(issues, ['url_or_file points to placeholder example.local']);
});

test('sourceAvailabilityRows describes blueprint sources as usable, gated, or manual', () => {
  const rows = sourceAvailabilityRows();
  const byId = new Map(rows.map(row => [row.source_id, row.status]));

  assert.equal(byId.get('paraguay_senacsa_frigorificos'), 'usable_structured');
  assert.equal(byId.get('uruguay_meats_exporters'), 'usable_structured');
  assert.equal(byId.get('brazil_mapa_dipoa'), 'gated_entry_only');
  assert.equal(byId.get('brazil_comex_stat'), 'api_connected_route_signal_only');
  assert.equal(byId.get('paid_bill_of_lading'), 'csv_xlsx_import_supported');
  assert.equal(byId.get('local_intelligence'), 'manual_verification_required');
});
