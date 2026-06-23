export const provider = {
  id: 'capability-fixture',
  label: 'Capability radar fixture',
  async collect({ today = new Date().toISOString().slice(0, 10) } = {}) {
    return {
      rows: [
        {
          capability_id: `fixture-capability-${today}`,
          source_id: 'capability-fixture',
          country: 'Uruguay',
          official_registration: 'INAC-3',
          legal_name: 'Frigorifico Carrasco S.A.',
          activity_type: 'slaughterhouse',
          animal_species: 'bovine',
          operational_status: 'active',
          product_scope: 'bovine meat and byproducts',
          byproduct_signal: 'official meat exporter; product scope requires omasum verification',
          cold_chain_signal: 'export cold chain likely; verify before outreach',
          source_url: 'https://www.inac.uy/innovaportal/v/10067/17/innova.front/exportadores',
          confidence: 'fixture',
          collected_at: today,
        },
      ],
      health: {
        provider_id: 'capability-fixture',
        status: 'ok',
        row_count: 1,
        collected_at: today,
      },
    };
  },
};

export default provider;
