import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectFromSource,
  extractOfficialDataLinks,
  extractLeadRows,
  parseSenacsaCsvRows,
  parseUruguayExporterRows,
  sourceConfigsFrom,
} from '../lib/collector.mjs';

const mission = {
  product: {
    accepted_forms: ['Frozen Salted Omasum'],
    excluded_products: ['rumen'],
  },
  keywords: {
    precise: ['librillo bovino'],
    broad: ['subproductos bovinos'],
    weak_signals: ['frigorifico'],
  },
};

test('sourceConfigsFrom returns enabled URL sources with canonical source types', () => {
  const configs = sourceConfigsFrom({
    manual_imports: [
      { id: 'local_file', path: 'samples/leads.tsv', enabled: true },
    ],
    official_sources: [
      { id: 'senacsa', country: 'Paraguay', label: 'SENACSA', url: 'https://example.test/senacsa', enabled: true },
      { id: 'disabled_official', url: 'https://example.test/disabled', enabled: false },
    ],
    trade_data_sources: [
      { id: 'comtrade', label: 'Comtrade', url: 'https://example.test/comtrade', enabled: true },
    ],
    weak_signal_sources: [
      { id: 'maps_without_url', label: 'Maps', enabled: true },
      { id: 'instagram', label: 'Instagram', url: 'https://example.test/ig', type: 'social_media', enabled: true },
    ],
  });

  assert.deepEqual(
    configs.map(source => [source.id, source.source_type, source.group]),
    [
      ['senacsa', 'official_list', 'official_sources'],
      ['comtrade', 'trade_data', 'trade_data_sources'],
      ['instagram', 'social_media', 'weak_signal_sources'],
    ],
  );
});

test('extractLeadRows turns relevant HTML blocks into scan-compatible lead rows', () => {
  const html = `
    <html>
      <body>
        <nav>Home | Contact</nav>
        <p>Frigorifico Norte S.A. - subproductos bovinos, omaso bovino y cold storage export.</p>
        <p>Rumen Trader Ltda - rumen and casings only.</p>
      </body>
    </html>
  `;

  const rows = extractLeadRows({
    source: {
      id: 'senacsa',
      label: 'SENACSA',
      country: 'Paraguay',
      source_type: 'official_list',
      url: 'https://example.test/senacsa',
      purpose: 'official exporter list',
    },
    text: html,
    mission,
    limit: 10,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].raw_company_name, 'Frigorifico Norte S.A.');
  assert.equal(rows[0].country, 'Paraguay');
  assert.equal(rows[0].company_type, 'frigorifico');
  assert.equal(rows[0].source_type, 'official_list');
  assert.match(rows[0].source_id, /^auto-senacsa-frigorifico-norte/);
  assert.equal(rows[0].url_or_file.startsWith('https://example.test/senacsa#auto-'), true);
  assert.match(rows[0].description, /subproductos bovinos/);
  assert.match(rows[0].notes, /自动采集/);
});

test('extractLeadRows does not let source labels make navigation text relevant', () => {
  const rows = extractLeadRows({
    source: {
      id: 'senacsa',
      label: 'SENACSA frigoríficos',
      country: 'Paraguay',
      source_type: 'official_list',
      url: 'https://example.test/senacsa',
      purpose: 'buscar frigoríficos habilitados',
    },
    text: '<p>Ir al contenido principal</p><p>Menú de navegación</p>',
    mission,
    limit: 10,
  });

  assert.deepEqual(rows, []);
});

test('extractLeadRows filters topic fragments that are not company leads', () => {
  const rows = extractLeadRows({
    source: {
      id: 'brazil_mapa_dipoa',
      label: 'MAPA',
      country: 'Brazil',
      source_type: 'official_list',
      url: 'https://example.test/mapa',
    },
    text: '<p>bee products and byproducts;</p><p>Lista de frigoríficos habilitados por cada país habilitado</p>',
    mission,
    limit: 10,
  });

  assert.deepEqual(rows, []);
});

test('parseUruguayExporterRows extracts only numbered exporter cards with registration and product URL', () => {
  const html = `
    <p class="elementor-heading-title">Uruguayan Meat Exporters</p>
    <p class="elementor-heading-title elementor-size-default">No. 3</p>
    <h2 class="product_title entry-title">Frigorífico Carrasco S.A.</h2>
    <a href="https://uymeats.com/product/frigorifico-carrasco-s-a-2/">Learn more</a>
    <p class="elementor-heading-title elementor-size-default">No. 7</p>
    <h2 class="product_title entry-title">Frigorifico PUL S.A</h2>
    <a href="/product/frigorifico-pul-s-a/">Learn more</a>
  `;

  const rows = parseUruguayExporterRows({
    source: {
      id: 'uruguay_meats_exporters',
      label: 'Uruguay Meats',
      country: 'Uruguay',
      source_type: 'official_list',
      url: 'https://uymeats.com/exporters/',
    },
    text: html,
    limit: 10,
  });

  assert.deepEqual(rows.map(row => [row.raw_company_name, row.official_registration, row.url_or_file]), [
    ['Frigorífico Carrasco S.A.', 'INAC-3', 'https://uymeats.com/product/frigorifico-carrasco-s-a-2/'],
    ['Frigorifico PUL S.A', 'INAC-7', 'https://uymeats.com/product/frigorifico-pul-s-a/'],
  ]);
  assert.equal(rows[0].company_type, 'frigorifico');
  assert.match(rows[0].notes, /结构化解析/);
});

test('parseUruguayExporterRows does not reuse a card number for later products', () => {
  const html = `
    <p class="elementor-heading-title elementor-size-default">No. 3</p>
    <h2 class="product_title entry-title">Frigorífico Carrasco S.A.</h2>
    <a href="/product/frigorifico-carrasco-s-a-2/">Learn more</a>
    <p class="elementor-heading-title elementor-size-default">No. 3,7 &amp; 8</p>
    <h2 class="product_title entry-title">Minerva Foods</h2>
    <a href="/product/minerva-foods/">Learn more</a>
  `;

  const rows = parseUruguayExporterRows({
    source: {
      id: 'uruguay_meats_exporters',
      label: 'Uruguay Meats',
      country: 'Uruguay',
      source_type: 'official_list',
      url: 'https://uymeats.com/exporters/',
    },
    text: html,
    limit: 10,
  });

  assert.deepEqual(rows.map(row => [row.raw_company_name, row.official_registration]), [
    ['Frigorífico Carrasco S.A.', 'INAC-3'],
    ['Minerva Foods', 'INAC-3-7-8'],
  ]);
});

test('parseSenacsaCsvRows aggregates official register rows into unique processors', () => {
  const csv = `"Mercaderia","Clasificacion Destino","Pais Destino","N° Registro Oficial","Establecimiento Procesador"
"Carne Bovina (ECB)","UNION EUROPEA","ALEMANIA","1","COOPERATIVA MULTIACTIVA NEULAND LTDA."
"","","","2","FRIGORIFICO FRIGOMERC S.A."
"","","Total ALEMANIA","",""
"Menudencias Bovinas","ASIA","HONG KONG","2","FRIGORIFICO FRIGOMERC S.A."
"","","HONG KONG","38","FRIGORIFICO CONCEPCION S.A."`;

  const rows = parseSenacsaCsvRows({
    source: {
      id: 'paraguay_senacsa_frigorificos',
      label: 'SENACSA',
      country: 'Paraguay',
      source_type: 'official_list',
      url: 'https://senacsa.gov.py/list',
    },
    csv,
    originUrl: 'https://docs.google.com/spreadsheets/d/sheet/export?format=csv',
    limit: 10,
  });

  assert.deepEqual(rows.map(row => [row.raw_company_name, row.official_registration]), [
    ['COOPERATIVA MULTIACTIVA NEULAND LTDA.', 'SENACSA-1'],
    ['FRIGORIFICO FRIGOMERC S.A.', 'SENACSA-2'],
    ['FRIGORIFICO CONCEPCION S.A.', 'SENACSA-38'],
  ]);
  assert.equal(rows[0].company_type, 'frigorifico');
  assert.equal(new Set(rows.map(row => row.url_or_file)).size, 3);
  assert.match(rows[1].url_or_file, /#registro-SENACSA-2$/);
  assert.match(rows[1].description, /Carne Bovina/);
  assert.match(rows[1].description, /Menudencias Bovinas/);
  assert.match(rows[1].description, /HONG KONG/);
});

test('parseSenacsaCsvRows deduplicates register variants and keeps the best processor name', () => {
  const csv = `"Mercaderia","Clasificacion Destino","Pais Destino","N° Registro Oficial","Establecimiento Procesador"
"Carne Bovina","ASIA","HONG KONG","23","FRIGORIFICO BELEN"
"Menudencia Bovina","ASIA","HONG KONG","23","FROGORIFICO BELEN"
"Carne Bovina","ASIA","TAIWAN","49/C2","FRIGORIFICO CONCEPCION S.A."
"Carne Bovina","ASIA","TAIWAN","49C/2","FRIGORIFICO CONCEPCION S.A."`;

  const rows = parseSenacsaCsvRows({
    source: {
      id: 'paraguay_senacsa_frigorificos',
      label: 'SENACSA',
      country: 'Paraguay',
      source_type: 'official_list',
      url: 'https://senacsa.gov.py/list',
    },
    csv,
    originUrl: 'https://docs.google.com/spreadsheets/d/sheet/export?format=csv',
    limit: 10,
  });

  assert.deepEqual(rows.map(row => [row.raw_company_name, row.official_registration]), [
    ['FRIGORIFICO BELEN', 'SENACSA-23'],
    ['FRIGORIFICO CONCEPCION S.A.', 'SENACSA-49/C2'],
  ]);
});

test('extractOfficialDataLinks finds Google Sheets CSV exports from source pages', () => {
  const links = extractOfficialDataLinks({
    sourceUrl: 'https://senacsa.gov.py/list',
    html: '<a href="https://docs.google.com/spreadsheets/d/abc123/edit?usp=drive_link&amp;rtpof=true">Lista</a>',
  });

  assert.deepEqual(links, [
    {
      type: 'google_sheet_csv',
      url: 'https://docs.google.com/spreadsheets/d/abc123/export?format=csv',
      label: 'Lista',
    },
  ]);
});

test('collectFromSource fetches content and records collection history', async () => {
  const fetchImpl = async url => {
    assert.equal(url, 'https://example.test/senacsa');
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'text/html; charset=utf-8']]),
      text: async () => '<p>Frigorifico Sur Ltda - librillo bovino export packing.</p>',
    };
  };

  const result = await collectFromSource({
    source: {
      id: 'senacsa',
      label: 'SENACSA',
      country: 'Paraguay',
      source_type: 'official_list',
      url: 'https://example.test/senacsa',
    },
    mission,
    fetchImpl,
  });

  assert.equal(result.rows.length, 1);
  assert.equal(result.history.status, 'collected');
  assert.equal(result.history.lead_count, '1');
  assert.equal(result.history.reason, 'OK');
});

test('collectFromSource uses SENACSA spreadsheet data when page links to a Google Sheet', async () => {
  const seen = [];
  const fetchImpl = async url => {
    seen.push(url);
    if (url === 'https://example.test/senacsa') {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<a href="https://docs.google.com/spreadsheets/d/sheet123/edit?usp=drive_link">Lista de frigoríficos</a>',
      };
    }
    assert.equal(url, 'https://docs.google.com/spreadsheets/d/sheet123/export?format=csv');
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'text/csv']]),
      text: async () => '"Mercaderia","Clasificacion Destino","Pais Destino","N° Registro Oficial","Establecimiento Procesador"\n"Carne Bovina","ASIA","HONG KONG","38","FRIGORIFICO CONCEPCION S.A."',
    };
  };

  const result = await collectFromSource({
    source: {
      id: 'paraguay_senacsa_frigorificos',
      label: 'SENACSA',
      country: 'Paraguay',
      source_type: 'official_list',
      url: 'https://example.test/senacsa',
    },
    mission,
    fetchImpl,
  });

  assert.deepEqual(seen, [
    'https://example.test/senacsa',
    'https://docs.google.com/spreadsheets/d/sheet123/export?format=csv',
  ]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].raw_company_name, 'FRIGORIFICO CONCEPCION S.A.');
  assert.equal(result.history.lead_count, '1');
});

test('collectFromSource reports fetch errors without throwing', async () => {
  const result = await collectFromSource({
    source: {
      id: 'broken',
      label: 'Broken',
      country: 'Brazil',
      source_type: 'official_list',
      url: 'https://example.test/broken',
    },
    mission,
    fetchImpl: async () => {
      throw new Error('network unavailable');
    },
  });

  assert.deepEqual(result.rows, []);
  assert.equal(result.history.status, 'error');
  assert.match(result.history.reason, /network unavailable/);
});
