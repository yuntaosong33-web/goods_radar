import {
  FACTORY_CAPABILITY_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
} from '../constants.mjs';
import { loadSourceProviders, validateProviderResult } from './provider-loader.mjs';

export const DEFAULT_OFFICIAL_CAPABILITY_PROVIDER_IDS = [
  'brazil-mapa-sif',
  'argentina-senasa',
  'chile-sag',
  'colombia-invima',
  'uruguay-inac',
];

function pickCountry(rows = []) {
  return rows.find(row => row.country)?.country || '';
}

function normalizeCapabilityRow({ row, providerId, today, sourceStatus = '' }) {
  const normalized = {};
  for (const header of FACTORY_CAPABILITY_HEADERS) {
    normalized[header] = row[header] ?? '';
  }
  normalized.source_id ||= providerId;
  normalized.collected_at ||= today;
  normalized.source_status ||= sourceStatus || 'provider_staged';
  return normalized;
}

function normalizeHealthRow({ provider, result, error, today }) {
  const rows = result?.rows || [];
  const health = result?.health || {};
  const status = error ? 'error' : (health.status || 'ok');
  const normalized = {
    source_id: provider.id,
    country: health.country || pickCountry(rows),
    layer: health.layer || 'source_provider',
    status,
    retrieval: health.retrieval || 'provider_collect',
    row_count: error ? 0 : String(health.row_count ?? rows.length),
    source_url: health.source_url || rows.find(row => row.source_url)?.source_url || '',
    reason: error ? error.message : (health.reason || ''),
    collected_at: health.collected_at || today,
  };

  const row = {};
  for (const header of RADAR_SOURCE_HEALTH_HEADERS) {
    row[header] = normalized[header] ?? '';
  }
  return row;
}

function isCapabilityRow(row) {
  return Boolean(row?.capability_id || row?.official_registration || row?.activity_type || row?.product_scope);
}

export async function runSourceProviders({
  providerIds = DEFAULT_OFFICIAL_CAPABILITY_PROVIDER_IDS,
  providers = null,
  today = new Date().toISOString().slice(0, 10),
} = {}) {
  const loadedProviders = providers || await loadSourceProviders(providerIds);
  const capabilityRows = [];
  const rawRows = [];
  const healthRows = [];

  for (const provider of loadedProviders) {
    try {
      const result = await provider.collect({ today });
      validateProviderResult(provider, result);
      rawRows.push(...result.rows.map(row => ({ ...row, source_id: row.source_id || provider.id })));
      for (const row of result.rows.filter(isCapabilityRow)) {
        capabilityRows.push(normalizeCapabilityRow({
          row,
          providerId: provider.id,
          today,
          sourceStatus: result.health?.status,
        }));
      }
      healthRows.push(normalizeHealthRow({ provider, result, today }));
    } catch (error) {
      healthRows.push(normalizeHealthRow({ provider, error, today }));
    }
  }

  return {
    capabilityRows,
    rawRows,
    healthRows,
    summary: {
      providers: loadedProviders.length,
      capabilityRows: capabilityRows.length,
      healthOk: healthRows.filter(row => row.status === 'ok').length,
      healthError: healthRows.filter(row => row.status === 'error').length,
    },
  };
}
