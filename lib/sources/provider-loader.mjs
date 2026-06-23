const PROVIDER_MODULES = {
  'capability-fixture': './providers/capability-fixture.mjs',
  senacsa: './providers/senacsa.mjs',
  'uruguay-meats': './providers/uruguay-meats.mjs',
  'brazil-comex': './providers/brazil-comex.mjs',
  'brazil-mapa-sif': './providers/brazil-mapa-sif.mjs',
  'argentina-senasa': './providers/argentina-senasa.mjs',
  'chile-sag': './providers/chile-sag.mjs',
  'colombia-invima': './providers/colombia-invima.mjs',
  'uruguay-inac': './providers/uruguay-inac.mjs',
};

export async function loadSourceProviders(ids = Object.keys(PROVIDER_MODULES)) {
  const providers = [];
  for (const id of ids) {
    const modulePath = PROVIDER_MODULES[id];
    if (!modulePath) throw new Error(`Unknown source provider: ${id}`);
    const mod = await import(modulePath);
    const provider = mod.default || mod.provider;
    if (!provider?.id || typeof provider.collect !== 'function') {
      throw new Error(`Invalid source provider module: ${id}`);
    }
    providers.push(provider);
  }
  return providers;
}

export function validateProviderResult(provider, result) {
  if (!result || !Array.isArray(result.rows)) {
    throw new Error(`Provider ${provider.id} must return { rows, health }`);
  }
  if (!result.health || typeof result.health !== 'object') {
    throw new Error(`Provider ${provider.id} must return health metadata`);
  }
  for (const row of result.rows) {
    if (!row.source_url && !row.url_or_file) {
      throw new Error(`Provider ${provider.id} row ${row.source_id || row.capability_id || 'unknown'} missing source_url or url_or_file provenance`);
    }
  }
  return true;
}
