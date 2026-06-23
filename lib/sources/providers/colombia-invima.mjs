import { officialCapabilityProvider } from './official-capability-fixture.mjs';

export default officialCapabilityProvider({
  id: 'colombia-invima',
  label: 'Colombia INVIMA structured capability',
  row: {
    capability_id: 'co-invima-capability',
    country: 'Colombia',
    official_registration: 'INVIMA-CO-0001',
    legal_name: 'Colombia INVIMA Meat Establishment',
    plant_name: 'Colombia INVIMA Meat Establishment',
    activity_type: 'slaughterhouse',
    animal_species: 'bovine',
    operational_status: 'active',
    product_scope: 'bovine meat establishment',
    byproduct_signal: 'offal scope requires omasum verification',
    cold_chain_signal: 'cold-chain readiness unknown',
    source_url: 'https://www.invima.gov.co/',
    source_status: 'structured_official',
  },
});
