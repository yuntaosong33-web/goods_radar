import { officialCapabilityProvider } from './official-capability-fixture.mjs';

export default officialCapabilityProvider({
  id: 'argentina-senasa',
  label: 'Argentina SENASA structured capability',
  row: {
    capability_id: 'ar-senasa-capability',
    country: 'Argentina',
    official_registration: 'SENASA-AR-0001',
    legal_name: 'Argentina SENASA Beef Establishment',
    plant_name: 'Argentina SENASA Beef Establishment',
    activity_type: 'slaughterhouse',
    animal_species: 'bovine',
    operational_status: 'active',
    product_scope: 'bovine slaughter and byproducts',
    byproduct_signal: 'menudencias/offal scope requires product verification',
    cold_chain_signal: 'export plant cold-chain signal',
    source_url: 'https://www.argentina.gob.ar/senasa/',
    source_status: 'structured_official',
  },
});
