export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some(value => value.trim() !== '')) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(header => String(header ?? '').trim());
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? '').trim()])));
}
