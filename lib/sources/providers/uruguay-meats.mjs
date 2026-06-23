import { parseUruguayExporterRows } from '../../collector.mjs';
import { fetchText } from '../http.mjs';

export const provider = {
  id: 'uruguay-meats',
  label: 'Uruguay Meats public exporter directory',
  async collect({ source, fetchImpl, limit = 50 } = {}) {
    if (!source?.url) {
      return { rows: [], health: { provider_id: 'uruguay-meats', status: 'blocked', reason: 'missing source.url', row_count: 0 } };
    }
    const response = await fetchText(source.url, { fetchImpl });
    const rows = parseUruguayExporterRows({
      source: {
        id: source.id || 'uruguay_meats_exporters',
        label: source.label || 'Uruguay Meats',
        country: source.country || 'Uruguay',
        source_type: source.source_type || 'official_list',
        url: source.url,
      },
      text: response.text,
      limit,
    });
    return {
      rows,
      health: {
        provider_id: 'uruguay-meats',
        status: response.ok ? 'ok' : 'error',
        row_count: rows.length,
        source_url: source.url,
        reason: response.statusText || '',
      },
    };
  },
};

export default provider;
