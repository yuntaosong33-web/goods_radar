import { existsSync, readFileSync } from 'fs';

function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === "'" && !inDouble) inSingle = !inSingle;
    if (char === '"' && !inSingle) inDouble = !inDouble;
    if (char === '#' && !inSingle && !inDouble) return line.slice(0, i);
  }
  return line;
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === '') return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function splitKeyValue(content) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    if (char === "'" && !inDouble) inSingle = !inSingle;
    if (char === '"' && !inSingle) inDouble = !inDouble;
    if (char === ':' && !inSingle && !inDouble) {
      return [content.slice(0, i).trim(), content.slice(i + 1).trim()];
    }
  }
  return [content.trim(), ''];
}

function nextContainerType(lines, index, indent) {
  for (let i = index + 1; i < lines.length; i += 1) {
    const raw = stripComment(lines[i]);
    if (!raw.trim()) continue;
    const nextIndent = raw.match(/^ */)[0].length;
    if (nextIndent <= indent) return 'object';
    return raw.trim().startsWith('- ') ? 'array' : 'object';
  }
  return 'object';
}

export function parseYaml(text) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, value: root }];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = stripComment(lines[index]);
    if (!raw.trim()) continue;

    const indent = raw.match(/^ */)[0].length;
    const content = raw.trim();
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].value;

    if (content.startsWith('- ')) {
      if (!Array.isArray(parent)) {
        throw new Error(`Invalid YAML list item without array parent at line ${index + 1}`);
      }
      const itemContent = content.slice(2).trim();
      if (itemContent.includes(':')) {
        const [key, rawValue] = splitKeyValue(itemContent);
        const item = {};
        item[key] = rawValue === '' ? {} : parseScalar(rawValue);
        parent.push(item);
        stack.push({ indent, value: item });
      } else {
        parent.push(parseScalar(itemContent));
      }
      continue;
    }

    const [key, rawValue] = splitKeyValue(content);
    if (!key) continue;

    if (rawValue === '') {
      const type = nextContainerType(lines, index, indent);
      const child = type === 'array' ? [] : {};
      parent[key] = child;
      stack.push({ indent, value: child });
    } else {
      parent[key] = parseScalar(rawValue);
    }
  }

  return root;
}

export function loadYamlFile(path) {
  if (!existsSync(path)) return null;
  return parseYaml(readFileSync(path, 'utf8'));
}
