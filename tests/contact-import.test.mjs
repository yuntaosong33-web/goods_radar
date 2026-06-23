import assert from 'node:assert/strict';
import test from 'node:test';

import { buildContactImportRows } from '../lib/contact-import.mjs';

test('buildContactImportRows imports only approved public contact staging rows', () => {
  const rows = buildContactImportRows({
    stagedRows: [
      {
        company_key: 'uruguay:frigorifico carrasco',
        normalized_company_name: 'Frigorifico Carrasco',
        email: 'export@supplier.example',
        phone: '+598 99 123 456',
        contact_page: 'https://supplier.example/contact',
        source_url: 'https://supplier.example/contact',
        review_status: 'approved',
      },
      {
        company_key: 'brazil:pending',
        normalized_company_name: 'Pending',
        email: 'pending@supplier.example',
        source_url: 'https://supplier.example/contact',
        review_status: 'pending_review',
      },
    ],
    importedAt: '2026-06-15',
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].contact_id, 'contact-uruguay-frigorifico-carrasco-2026-06-15');
  assert.equal(rows[0].company_key, 'uruguay:frigorifico carrasco');
  assert.equal(rows[0].email, 'export@supplier.example');
  assert.equal(rows[0].whatsapp, '+598 99 123 456');
  assert.equal(rows[0].relationship_source, 'https://supplier.example/contact');
  assert.equal(rows[0].trust_level, 'public_approved');
});

test('buildContactImportRows skips duplicate contact channels', () => {
  const rows = buildContactImportRows({
    stagedRows: [
      {
        company_key: 'uruguay:frigorifico carrasco',
        normalized_company_name: 'Frigorifico Carrasco',
        email: 'export@supplier.example',
        source_url: 'https://supplier.example/contact',
        review_status: 'approved',
      },
    ],
    existingRows: [
      {
        company_key: 'uruguay:frigorifico carrasco',
        normalized_company_name: 'Frigorifico Carrasco',
        email: 'export@supplier.example',
      },
    ],
    importedAt: '2026-06-15',
  });

  assert.deepEqual(rows, []);
});
