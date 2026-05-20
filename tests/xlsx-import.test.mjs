import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import test from 'node:test';

import { readBillFile } from '../lib/bill-of-lading.mjs';

function dosDateTime() {
  return { time: 0, date: 0x21 };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFile(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, date } = dosDateTime();

  for (const [name, text] of entries) {
    const nameBuffer = Buffer.from(name);
    const data = Buffer.from(text);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralOffset = offset;
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

function cell(ref, type, value) {
  if (type === 's') return `<c r="${ref}" t="s"><v>${value}</v></c>`;
  return `<c r="${ref}"><v>${value}</v></c>`;
}

test('readBillFile imports a minimal XLSX bill of lading sheet', () => {
  const dir = join(tmpdir(), `goods-radar-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'bol.xlsx');
  const shared = [
    'Date', 'Shipper', 'Shipper Country', 'Consignee', 'Destination Country', 'Port', 'HS Code',
    'Product Description', 'Net Weight KG', 'Containers', 'B/L No', 'Source',
    '2024-11-03', 'Frigorifico Modelo S.A', 'Uruguay', 'Buyer Ltd', 'Vietnam', 'Hai Phong',
    '05040000', 'Frozen Salted Omasum', '28000', '1', 'BL123', 'panjiva://BL123',
  ];
  const sharedXml = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${shared.map(value => `<si><t>${value}</t></si>`).join('')}</sst>`;
  const row1 = shared.slice(0, 12).map((_, index) => cell(`${String.fromCharCode(65 + index)}1`, 's', index)).join('');
  const row2 = shared.slice(12).map((_, index) => cell(`${String.fromCharCode(65 + index)}2`, 's', index + 12)).join('');
  const sheetXml = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${row1}</row><row r="2">${row2}</row></sheetData></worksheet>`;
  writeFileSync(path, zipFile([
    ['xl/sharedStrings.xml', sharedXml],
    ['xl/worksheets/sheet1.xml', sheetXml],
  ]));

  const rows = readBillFile(path);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].shipper, 'Frigorifico Modelo S.A');
  assert.equal(rows[0].product_description, 'Frozen Salted Omasum');
  assert.equal(rows[0].bill_of_lading_no, 'BL123');
});
