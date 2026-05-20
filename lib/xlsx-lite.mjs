import { inflateRawSync } from 'zlib';

function decodeXml(text) {
  return String(text ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function findEndOfCentralDirectory(buffer) {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) return index;
  }
  throw new Error('Invalid XLSX zip: missing central directory');
}

function unzipEntries(buffer) {
  const entries = new Map();
  const eocd = findEndOfCentralDirectory(buffer);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid XLSX zip: bad central header');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : inflateRawSync(compressed);
    entries.set(name, data.toString('utf8'));

    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function columnIndex(ref) {
  const letters = String(ref || '').replace(/[^A-Z]/gi, '').toUpperCase();
  let value = 0;
  for (const letter of letters) value = value * 26 + (letter.charCodeAt(0) - 64);
  return value - 1;
}

function sharedStringsFrom(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map(match =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map(text => decodeXml(text[1])).join(''),
  );
}

function cellValue(cellXml, sharedStrings) {
  const type = cellXml.match(/\bt=["']([^"']+)["']/i)?.[1] || '';
  const inline = cellXml.match(/<is\b[^>]*>[\s\S]*?<t\b[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/i)?.[1];
  if (inline !== undefined) return decodeXml(inline);
  const value = cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? '';
  if (type === 's') return sharedStrings[Number(value)] ?? '';
  return decodeXml(value);
}

export function rowsFromXlsxBuffer(buffer) {
  const entries = unzipEntries(buffer);
  const sharedStrings = sharedStringsFrom(entries.get('xl/sharedStrings.xml'));
  const sheet = entries.get('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('XLSX file does not contain xl/worksheets/sheet1.xml');

  const matrix = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/gi)) {
    const values = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
      const ref = cellMatch[1].match(/\br=["']([^"']+)["']/i)?.[1] || '';
      values[columnIndex(ref)] = cellValue(cellMatch[0], sharedStrings);
    }
    matrix.push(values.map(value => value ?? ''));
  }

  if (!matrix.length) return [];
  const headers = matrix[0].map(header => String(header || '').trim());
  return matrix.slice(1).filter(row => row.some(value => String(value || '').trim())).map(row =>
    Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? '').trim()])),
  );
}
