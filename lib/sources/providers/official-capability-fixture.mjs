export function officialCapabilityProvider({ id, label, row }) {
  return {
    id,
    label,
    async collect({ today = new Date().toISOString().slice(0, 10) } = {}) {
      return {
        rows: [],
        health: {
          provider_id: id,
          status: 'manual_required',
          row_count: 0,
          source_url: row.source_url,
          reason: 'Live parser not implemented; manual official export or parser required before staging capability rows.',
          collected_at: today,
        },
      };
    },
  };
}
