import { officialCapabilityProvider } from './official-capability-fixture.mjs';

export default officialCapabilityProvider({
  id: 'chile-sag',
  label: 'Chile SAG structured capability',
  row: {
    capability_id: 'cl-sag-capability',
    country: 'Chile',
    official_registration: 'SAG-CL-0001',
    legal_name: 'Chile SAG Beef Establishment',
    plant_name: 'Chile SAG Beef Establishment',
    activity_type: 'exporter',
    animal_species: 'bovine',
    operational_status: 'active',
    product_scope: 'animal-origin export establishment',
    byproduct_signal: 'byproduct scope requires manual product verification',
    cold_chain_signal: 'export listing suggests cold-chain readiness',
    source_url: 'https://www.sag.gob.cl/',
    source_status: 'structured_official',
  },
});
