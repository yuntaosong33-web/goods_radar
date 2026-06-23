import { parseSenacsaCsvRows } from '../../collector.mjs';
import { fetchText } from '../http.mjs';

export const provider = {
  id: 'senacsa',
  label: 'Paraguay SENACSA public list',
  async collect({ source, fetchImpl, mission = {}, limit = 50 } = {}) {
    if (!source?.url) {
      return { rows: [], health: { provider_id: 'senacsa', status: 'blocked', reason: 'missing source.url', row_count: 0 } };
    }
    const response = await fetchText(source.url, { fetchImpl });
    const rows = parseSenacsaCsvRows({
      source: {
        id: source.id || 'paraguay_senacsa_frigorificos',
        label: source.label || 'SENACSA',
        country: source.country || 'Paraguay',
        source_type: source.source_type || 'official_list',
        url: source.url,
      },
      csv: response.text,
      originUrl: source.url,
      mission,
      limit,
    });
    return {
      rows,
      health: {
        provider_id: 'senacsa',
        status: response.ok ? 'ok' : 'error',
        row_count: rows.length,
        source_url: source.url,
        reason: response.statusText || '',
      },
    };
  },
};

export default provider;
