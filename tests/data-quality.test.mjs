import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateContactRows,
  validateQuoteRows,
  validateTrialRows,
} from '../lib/data-quality.mjs';

test('validateContactRows allows empty schema-only contact tables', () => {
  assert.deepEqual(validateContactRows([]), []);
});

test('validateContactRows requires a contact channel when a contact row exists', () => {
  const issues = validateContactRows([
    {
      contact_id: 'contact-1',
      company_key: 'br:frigorifico-x',
      normalized_company_name: 'Frigorifico X',
      contact_name: 'Maria',
    },
  ]);

  assert.deepEqual(issues, [
    'contact-1: contact row needs whatsapp or email',
  ]);
});

test('validateQuoteRows requires commercial proof fields for quote/QC records', () => {
  const issues = validateQuoteRows([
    {
      quote_id: 'quote-1',
      company_key: 'py:frigorifico-y',
      normalized_company_name: 'Frigorifico Y',
      product_original: 'librillo',
      incoterm: 'FOB',
      quoted_at: '2026-05-27',
    },
  ]);

  assert.deepEqual(issues, [
    'quote-1: quote row needs price',
  ]);
});

test('validateTrialRows requires positive quantity and valid loss percent when trial rows exist', () => {
  const issues = validateTrialRows([
    {
      trial_id: 'trial-1',
      company_key: 'uy:frigorifico-z',
      normalized_company_name: 'Frigorifico Z',
      country: 'Uruguay',
      product: 'Omasum',
      quantity_mt: '-1',
      actual_loss_percent: '150',
      date: '2026-05-27',
    },
  ]);

  assert.deepEqual(issues, [
    'trial-1: quantity_mt must be positive',
    'trial-1: actual_loss_percent must be 0-100 when provided',
  ]);
});

test('data quality validators accept complete P0 capture rows', () => {
  assert.deepEqual(validateContactRows([
    {
      contact_id: 'contact-1',
      company_key: 'br:frigorifico-x',
      normalized_company_name: 'Frigorifico X',
      contact_name: 'Maria',
      whatsapp: '+55...',
    },
  ]), []);
  assert.deepEqual(validateQuoteRows([
    {
      quote_id: 'quote-1',
      company_key: 'py:frigorifico-y',
      normalized_company_name: 'Frigorifico Y',
      product_original: 'librillo',
      price: 'USD 4.20/kg',
      incoterm: 'FOB',
      quoted_at: '2026-05-27',
    },
  ]), []);
  assert.deepEqual(validateTrialRows([
    {
      trial_id: 'trial-1',
      company_key: 'uy:frigorifico-z',
      normalized_company_name: 'Frigorifico Z',
      country: 'Uruguay',
      product: 'Omasum',
      quantity_mt: '2',
      actual_loss_percent: '6.5',
      date: '2026-05-27',
    },
  ]), []);
});
