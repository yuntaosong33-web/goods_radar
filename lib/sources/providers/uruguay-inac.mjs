import { officialCapabilityProvider } from './official-capability-fixture.mjs';

export default officialCapabilityProvider({
  id: 'uruguay-inac',
  label: 'Uruguay INAC structured capability',
  row: {
    capability_id: 'uy-inac-capability',
    country: 'Uruguay',
    official_registration: 'INAC-UY-0001',
    legal_name: 'Uruguay INAC Beef Export Establishment',
    plant_name: 'Uruguay INAC Beef Export Establishment',
    activity_type: 'slaughterhouse',
    animal_species: 'bovine',
    operational_status: 'active',
    product_scope: 'bovine meat and byproducts export',
    byproduct_signal: 'menudencias/byproduct signal requires product verification',
    cold_chain_signal: 'export cold-chain likely',
    source_url: 'https://www.inac.uy/',
    source_status: 'structured_official',
  },
});
