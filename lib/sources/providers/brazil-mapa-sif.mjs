import { officialCapabilityProvider } from './official-capability-fixture.mjs';

export default officialCapabilityProvider({
  id: 'brazil-mapa-sif',
  label: 'Brazil MAPA SIF structured capability',
  row: {
    capability_id: 'br-mapa-sif-capability',
    country: 'Brazil',
    official_registration: 'SIF-0001',
    legal_name: 'Brazil MAPA SIF Beef Establishment',
    plant_name: 'Brazil MAPA SIF Beef Establishment',
    activity_type: 'slaughterhouse',
    animal_species: 'bovine',
    operational_status: 'active',
    product_scope: 'bovine meat and edible byproducts',
    byproduct_signal: 'edible offal capability requires omasum verification',
    cold_chain_signal: 'export cold-chain capability requires verification',
    source_url: 'https://dados.agricultura.gov.br/',
    source_status: 'structured_official',
  },
});
