import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectProductScopeRows,
  extractProductScopeRows,
  isAllowedProductScopeUrl,
} from '../lib/product-scope-evidence.mjs';

test('isAllowedProductScopeUrl accepts public company/catalog/product pages only', () => {
  assert.equal(isAllowedProductScopeUrl('https://supplier.example/products/offal'), true);
  assert.equal(isAllowedProductScopeUrl('https://supplier.example/catalog.pdf'), true);
  assert.equal(isAllowedProductScopeUrl('mailto:sales@supplier.example'), false);
  assert.equal(isAllowedProductScopeUrl('https://facebook.com/supplier/photos'), false);
  assert.equal(isAllowedProductScopeUrl('https://x.com/supplier'), false);
  assert.equal(isAllowedProductScopeUrl('https://wa.me/59899123456'), false);
  assert.equal(isAllowedProductScopeUrl('https://supplier.example/login/products'), false);
});

test('extractProductScopeRows stages omasum terms with source provenance', () => {
  const rows = extractProductScopeRows({
    company: {
      source_id: 'uy-1',
      normalized_company_name: 'Frigorifico Carrasco',
      country: 'Uruguay',
    },
    pageUrl: 'https://supplier.example/products/offal',
    html: '<main>Menudencias bovinas: librillo, omaso, mondongo. Export frozen offal.</main>',
  });

  assert.equal(rows.length >= 2, true);
  assert.equal(rows[0].company_key, 'uruguay:frigorifico carrasco');
  assert.equal(rows[0].source_id, 'uy-1');
  assert.equal(rows[0].evidence_url, 'https://supplier.example/products/offal');
  assert.equal(rows[0].source_url, 'https://supplier.example/products/offal');
  assert.equal(rows[0].review_status, 'pending_review');
  assert.ok(rows.some(row => row.product_term === 'librillo'));
  assert.ok(rows.some(row => row.product_term === 'omaso'));
});

test('extractProductScopeRows does not turn existing company notes into page product evidence', () => {
  const rows = extractProductScopeRows({
    company: {
      source_id: 'py-1',
      normalized_company_name: 'FRIGORIFICO FRIGOMERC',
      country: 'Paraguay',
      notes: 'Mercaderia: Carne Bovina (ECB), Menudencia Bovina (EMB); Clasificacion destino: UNION EUROPEA',
    },
    pageUrl: 'https://supplier.example/profile',
    html: '<main>Company profile and export markets.</main>',
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].product_term, '');
  assert.equal(rows[0].confidence, 'low');
  assert.equal(rows[0].review_status, 'manual_required');
  assert.match(rows[0].notes, /no omasum\/byproduct product-scope term extracted/i);
});

test('extractProductScopeRows does not turn company name terms into page product evidence', () => {
  const rows = extractProductScopeRows({
    company: {
      source_id: 'uy-omasum-name',
      normalized_company_name: 'Acme Omasum Export',
      raw_company_name: 'Acme Omasum Export',
      country: 'Uruguay',
    },
    pageUrl: 'https://supplier.example/profile',
    html: '<main>General exporter profile and market coverage.</main>',
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].product_term, '');
  assert.equal(rows[0].review_status, 'manual_required');
});

test('collectProductScopeRows blocks social/login sources and records manual-required staging rows', async () => {
  const seen = [];
  const result = await collectProductScopeRows({
    companies: [
      {
        source_id: 'bad',
        normalized_company_name: 'Bad Source',
        country: 'Brazil',
        url_or_file: 'https://instagram.com/bad',
      },
      {
        source_id: 'good',
        normalized_company_name: 'Good Source',
        country: 'Brazil',
        url_or_file: 'https://supplier.example/catalog',
      },
    ],
    fetchImpl: async url => {
      seen.push(url);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<p>Products: folhoso bovino and miudos bovinos.</p>',
      };
    },
  });

  assert.deepEqual(seen, ['https://supplier.example/catalog']);
  assert.equal(result.health.blocked, 1);
  assert.equal(result.health.fetched, 1);
  assert.ok(result.rows.some(row => row.company_key === 'brazil:bad source' && row.review_status === 'manual_required'));
  assert.ok(result.rows.some(row => row.product_term === 'folhoso'));
});

test('collectProductScopeRows treats HTTP failures as manual-required fetch errors', async () => {
  const result = await collectProductScopeRows({
    companies: [{
      source_id: 'good',
      normalized_company_name: 'HTTP Failed Product Page',
      country: 'Brazil',
      url_or_file: 'https://supplier.example/catalog',
      notes: 'librillo appears in stale company notes',
    }],
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      text: async () => '<p>folhoso bovino</p>',
    }),
  });

  assert.equal(result.health.fetched, 0);
  assert.equal(result.health.errors, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].review_status, 'manual_required');
  assert.equal(result.rows[0].product_term, '');
  assert.match(result.rows[0].notes, /HTTP 500 Server Error/);
});
