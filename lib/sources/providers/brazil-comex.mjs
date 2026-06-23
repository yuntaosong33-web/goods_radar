import { collectBrazilComexRoutes } from '../../trade-routes.mjs';

export const provider = {
  id: 'brazil-comex',
  label: 'Brazil Comex Stat public route aggregate',
  async collect({ fetchImpl, today } = {}) {
    const result = await collectBrazilComexRoutes({ fetchImpl, collectedAt: today });
    return {
      rows: result.rows || [],
      health: {
        provider_id: 'brazil-comex',
        status: result.history?.status || 'unknown',
        row_count: (result.rows || []).length,
        source_url: result.history?.source_url || 'https://comexstat.mdic.gov.br/',
        reason: result.history?.reason || '',
      },
    };
  },
};

export default provider;
