export function chooseScanImports({
  fixture = null,
  sources = {},
  collect = false,
  collectedPath = 'data/auto-leads.tsv',
  collectedExists = false,
  sampleExists = false,
}) {
  if (fixture) return [{ path: fixture, id: 'fixture' }];

  const imports = [];
  if (collect && collectedExists) imports.push({ path: collectedPath, id: 'auto_collect' });

  const manual = Array.isArray(sources.manual_imports) ? sources.manual_imports : [];
  const enabled = manual.filter(item => item.enabled !== false && item.path);
  imports.push(...enabled);

  if (imports.length) return imports;
  if (sampleExists) return [{ path: 'samples/leads.tsv', id: 'sample_leads' }];
  return [];
}
