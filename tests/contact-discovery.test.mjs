import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectContactRows,
  discoverContactsFromPage,
  isAllowedContactUrl,
} from '../lib/contact-discovery.mjs';

test('isAllowedContactUrl accepts only public http/https contact surfaces', () => {
  assert.equal(isAllowedContactUrl('https://supplier.example/contact'), true);
  assert.equal(isAllowedContactUrl('http://supplier.example/contacto'), true);
  assert.equal(isAllowedContactUrl('mailto:sales@supplier.example'), false);
  assert.equal(isAllowedContactUrl('https://facebook.com/supplier/messages'), false);
  assert.equal(isAllowedContactUrl('https://linkedin.com/company/supplier'), false);
  assert.equal(isAllowedContactUrl('https://x.com/supplier'), false);
  assert.equal(isAllowedContactUrl('https://wa.me/59899123456'), false);
  assert.equal(isAllowedContactUrl('https://supplier.example/login'), false);
});

test('discoverContactsFromPage extracts emails, phones, contact page and provenance', () => {
  const rows = discoverContactsFromPage({
    company: {
      source_id: 'uy-1',
      normalized_company_name: 'Frigorifico Carrasco',
      country: 'Uruguay',
    },
    sourceId: 'company_website',
    pageUrl: 'https://supplier.example/home',
    html: `
      <a href="/contact">Contact</a>
      <a href="mailto:ventas@supplier.example">ventas@supplier.example</a>
      <p>WhatsApp +598 99 123 456</p>
    `,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].company_key, 'uruguay:frigorifico carrasco');
  assert.equal(rows[0].source_id, 'company_website');
  assert.equal(rows[0].email, 'ventas@supplier.example');
  assert.equal(rows[0].phone, '+598 99 123 456');
  assert.equal(rows[0].contact_page, 'https://supplier.example/contact');
  assert.equal(rows[0].source_url, 'https://supplier.example/home');
  assert.equal(rows[0].confidence, 'medium');
  assert.equal(rows[0].review_status, 'pending_review');
});

test('collectContactRows blocks login and social sources as manual-required rows', async () => {
  const seen = [];
  const result = await collectContactRows({
    companies: [
      {
        source_id: 'c1',
        normalized_company_name: 'Blocked Social',
        country: 'Brazil',
        url_or_file: 'https://facebook.com/company',
      },
      {
        source_id: 'c2',
        normalized_company_name: 'Public Supplier',
        country: 'Brazil',
        url_or_file: 'https://supplier.example',
      },
    ],
    fetchImpl: async url => {
      seen.push(url);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: async () => '<a href="/contact">Contact</a><p>Email export@supplier.example</p>',
      };
    },
  });

  assert.deepEqual(seen, ['https://supplier.example']);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows.find(row => row.company_key === 'brazil:blocked social').review_status, 'manual_required');
  assert.equal(result.rows.find(row => row.company_key === 'brazil:public supplier').email, 'export@supplier.example');
  assert.equal(result.health.blocked, 1);
  assert.equal(result.health.fetched, 1);
});

test('collectContactRows treats HTTP failures as manual-required fetch errors', async () => {
  const result = await collectContactRows({
    companies: [{
      source_id: 'c1',
      normalized_company_name: 'HTTP Failed Supplier',
      country: 'Brazil',
      url_or_file: 'https://supplier.example/contact',
    }],
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: async () => '<p>export@supplier.example</p>',
    }),
  });

  assert.equal(result.health.fetched, 0);
  assert.equal(result.health.errors, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].review_status, 'manual_required');
  assert.equal(result.rows[0].email, '');
  assert.match(result.rows[0].notes, /HTTP 404 Not Found/);
});
