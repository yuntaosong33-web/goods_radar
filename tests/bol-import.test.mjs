import assert from 'node:assert/strict';
import test from 'node:test';

import {
  billRowsFromRecords,
  companiesFromBillRows,
  evidenceFromBillRows,
  parseBillCsv,
} from '../lib/bill-of-lading.mjs';

test('parseBillCsv normalizes common paid customs export columns', () => {
  const csv = [
    'Date,Shipper,Shipper Country,Consignee,Destination Country,Port,HS Code,Product Description,Net Weight KG,Containers,B/L No,Source',
    '2024-11-03,Frigorifico Modelo S.A,Uruguay,Buyer Ltd,Vietnam,Hai Phong,05040000,Frozen Salted Omasum,28000,1,BL123,panjiva://BL123',
  ].join('\n');

  const rows = parseBillCsv(csv, 'samples/bol.csv');

  assert.deepEqual(rows, [
    {
      shipment_id: 'bol-bl123',
      source_file: 'samples/bol.csv',
      source_platform: 'paid_customs_export',
      shipment_date: '2024-11-03',
      shipper: 'Frigorifico Modelo S.A',
      shipper_country: 'Uruguay',
      consignee: 'Buyer Ltd',
      destination_country: 'Vietnam',
      destination_port: 'Hai Phong',
      hs_code: '05040000',
      product_description: 'Frozen Salted Omasum',
      quantity_kg: '28000',
      container_count: '1',
      bill_of_lading_no: 'BL123',
      source_url_or_file: 'panjiva://BL123',
      evidence_level: 'E2',
      development_distance: 'D1',
      notes: '付费/明细海关数据导入；提单明细才可作为供应商证据',
    },
  ]);
});

test('billRowsFromRecords skips records without supplier, product, and shipment proof', () => {
  const rows = billRowsFromRecords([
    { shipper: 'Only Supplier' },
    {
      shipper: 'Frigorifico Modelo S.A',
      product_description: 'Frozen Salted Omasum',
      bill_of_lading_no: 'BL123',
      shipment_date: '2024-11-03',
    },
  ], 'input.csv');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].shipper, 'Frigorifico Modelo S.A');
});

test('evidenceFromBillRows creates E2 evidence and companiesFromBillRows creates D1 bill_of_lading leads', () => {
  const billRows = parseBillCsv([
    'Date,Shipper,Shipper Country,Consignee,Destination Country,Port,HS Code,Product Description,Net Weight KG,Containers,B/L No,Source',
    '2024-11-03,Frigorifico Modelo S.A,Uruguay,Buyer Ltd,Vietnam,Hai Phong,05040000,Frozen Salted Omasum,28000,1,BL123,panjiva://BL123',
  ].join('\n'), 'samples/bol.csv');

  const evidence = evidenceFromBillRows(billRows);
  const companies = companiesFromBillRows(billRows);

  assert.equal(evidence[0].evidence_type, 'bill_of_lading');
  assert.equal(evidence[0].evidence_level, 'E2');
  assert.match(evidence[0].summary, /Frozen Salted Omasum/);
  assert.equal(companies[0].source_type, 'bill_of_lading');
  assert.equal(companies[0].evidence_level, 'E2');
  assert.equal(companies[0].development_distance, 'D1');
  assert.equal(companies[0].route_feasibility, 'high');
});
