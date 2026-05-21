import {
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
} from './constants.mjs';
import { readTsv, writeTsv } from './tsv.mjs';
import { compactSpaces, normalizeCompanyName, normalizeText, slugify, todayIso } from './text.mjs';

export const RADAR_SOURCE_DEFINITIONS = [
  {
    id: 'brazil_mapa_sif_open_data',
    country: 'Brazil',
    layer: 'factory_capability',
    url: 'https://dados.agricultura.gov.br/sl/dataset/servico-de-inspecao-federal-sif/resource/97277e92-264a-4dc0-9aea-f87b8ea93798',
    retrieval: 'MAPA/SIF open data export',
  },
  {
    id: 'paraguay_senacsa_faena',
    country: 'Paraguay',
    layer: 'factory_capability',
    url: 'https://senacsa.gov.py/servicios/servicios-tecnicos/estadisticas/estadisticas-con-datos-abiertos/',
    retrieval: 'SENACSA official lists and faena/industrializacion files',
  },
  {
    id: 'uruguay_inac_mgap',
    country: 'Uruguay',
    layer: 'factory_capability',
    url: 'https://www.inac.uy/innovaportal/v/5539/10/innova.front/faena',
    retrieval: 'INAC slaughter files and MGAP DIA establishment lists',
  },
  {
    id: 'argentina_senasa_registros',
    country: 'Argentina',
    layer: 'factory_capability',
    url: 'https://www.argentina.gob.ar/senasa/programas-sanitarios/cadenaanimal/bovinos-y-bubalinos/bovinos-y-bubalinos-industria/registros',
    retrieval: 'SENASA registros / establecimientos habilitados',
  },
  {
    id: 'chile_sag_leepp',
    country: 'Chile',
    layer: 'factory_capability',
    url: 'https://www.sag.gob.cl/ambitos-de-accion/establecimientos-exportadores-de-productos-pecuarios',
    retrieval: 'SAG LEEPP and market habilitation lists',
  },
  {
    id: 'colombia_invima_carne',
    country: 'Colombia',
    layer: 'factory_capability',
    url: 'https://invima.gov.co/productos-vigilados/alimentos/carne',
    retrieval: 'INVIMA meat plant, HACCP, and status lists',
  },
];

const fixtureFactories = [
  {
    source_id: 'brazil_mapa_sif_open_data',
    country: 'Brazil',
    official_registration: 'SIF-1001',
    legal_name: 'Frigorifico Goias Exportadora S.A.',
    plant_name: 'Frigorifico Goias',
    city: 'Goiania',
    region: 'Goias',
    address: 'Goiania, GO',
    activity_type: 'abatedouro frigorifico',
    animal_species: 'bovine',
    operational_status: 'active',
    export_markets: 'other markets',
    product_scope: 'carne bovina; miudos bovinos',
    byproduct_signal: 'miudos bovinos; bucho bovino',
    cold_chain_signal: 'cameras frias',
  },
  {
    source_id: 'paraguay_senacsa_faena',
    country: 'Paraguay',
    official_registration: 'SENACSA-2',
    legal_name: 'FRIGORIFICO FRIGOMERC S.A.',
    plant_name: 'FRIGORIFICO FRIGOMERC',
    city: '',
    region: '',
    address: '',
    activity_type: 'frigorifico',
    animal_species: 'bovine',
    operational_status: 'active',
    export_markets: 'European Union; other markets',
    product_scope: 'Carne Bovina; Menudencia Bovina',
    byproduct_signal: 'menudencia bovina',
    cold_chain_signal: '',
  },
  {
    source_id: 'uruguay_inac_mgap',
    country: 'Uruguay',
    official_registration: 'INAC-3',
    legal_name: 'Frigorifico Carrasco S.A.',
    plant_name: 'Frigorifico Carrasco',
    city: 'Montevideo',
    region: 'Montevideo',
    address: 'Montevideo, Uruguay',
    activity_type: 'slaughterhouse',
    animal_species: 'bovine',
    operational_status: 'active',
    export_markets: 'China; European Union',
    product_scope: 'beef; edible bovine offal',
    byproduct_signal: 'visceras bovinas',
    cold_chain_signal: 'cold storage',
  },
  {
    source_id: 'argentina_senasa_registros',
    country: 'Argentina',
    official_registration: 'SENASA-AR-501',
    legal_name: 'Frigorifico Pampeano S.A.',
    plant_name: 'Frigorifico Pampeano',
    city: 'Rosario',
    region: 'Santa Fe',
    address: 'Rosario, Santa Fe',
    activity_type: 'matadero frigorifico',
    animal_species: 'bovine',
    operational_status: 'active',
    export_markets: 'Chile; other markets',
    product_scope: 'menudencias bovinas; carne bovina',
    byproduct_signal: 'menudencias bovinas; mondongo',
    cold_chain_signal: 'camara frigorifica',
  },
  {
    source_id: 'chile_sag_leepp',
    country: 'Chile',
    official_registration: 'SAG-LEEPP-220',
    legal_name: 'Planta Carnes Sur Ltda.',
    plant_name: 'Carnes Sur',
    city: 'Osorno',
    region: 'Los Lagos',
    address: 'Osorno, Chile',
    activity_type: 'planta faenadora; camara frigorifica',
    animal_species: 'bovine',
    operational_status: 'active',
    export_markets: 'China; Hong Kong',
    product_scope: 'productos pecuarios; subproductos comestibles',
    byproduct_signal: 'subproductos comestibles; visceras',
    cold_chain_signal: 'camara frigorifica',
  },
  {
    source_id: 'colombia_invima_carne',
    country: 'Colombia',
    official_registration: 'INVIMA-HACCP-77',
    legal_name: 'Planta Beneficio Andina S.A.S.',
    plant_name: 'Beneficio Andina',
    city: 'Bogota',
    region: 'Cundinamarca',
    address: 'Bogota, Colombia',
    activity_type: 'planta de beneficio bovino',
    animal_species: 'bovine',
    operational_status: 'active',
    export_markets: 'regional markets',
    product_scope: 'carne; visceras bovinas',
    byproduct_signal: 'visceras bovinas; mondongo',
    cold_chain_signal: 'cuarto frio',
  },
];

const fixtureCapacities = [
  {
    source_id: 'paraguay_senacsa_faena',
    country: 'Paraguay',
    official_registration: 'SENACSA-2',
    plant_name: 'FRIGORIFICO FRIGOMERC',
    region: '',
    period: '2024-12',
    species: 'bovine',
    category: 'total cattle',
    slaughter_head_count: '12000',
    capacity_scope: 'plant_month',
  },
  {
    source_id: 'uruguay_inac_mgap',
    country: 'Uruguay',
    official_registration: 'INAC-3',
    plant_name: 'Frigorifico Carrasco',
    region: 'Montevideo',
    period: '2024-12',
    species: 'bovine',
    category: 'total cattle',
    slaughter_head_count: '8000',
    capacity_scope: 'plant_month',
  },
  {
    source_id: 'argentina_senasa_registros',
    country: 'Argentina',
    official_registration: 'SENASA-AR-501',
    plant_name: 'Frigorifico Pampeano',
    region: 'Santa Fe',
    period: '2024-12',
    species: 'bovine',
    category: 'estimated cattle',
    slaughter_head_count: '6000',
    capacity_scope: 'plant_month',
  },
];

const fixtureApprovals = [
  {
    source_id: 'paraguay_senacsa_faena',
    country: 'Paraguay',
    official_registration: 'SENACSA-2',
    plant_name: 'FRIGORIFICO FRIGOMERC',
    destination_market: 'European Union',
    product_category: 'bovine meat and byproducts',
    approval_status: 'active',
  },
  {
    source_id: 'uruguay_inac_mgap',
    country: 'Uruguay',
    official_registration: 'INAC-3',
    plant_name: 'Frigorifico Carrasco',
    destination_market: 'China',
    product_category: 'bovine meat',
    approval_status: 'active',
  },
  {
    source_id: 'chile_sag_leepp',
    country: 'Chile',
    official_registration: 'SAG-LEEPP-220',
    plant_name: 'Carnes Sur',
    destination_market: 'Hong Kong',
    product_category: 'animal products',
    approval_status: 'active',
  },
  {
    source_id: 'colombia_invima_carne',
    country: 'Colombia',
    official_registration: 'INVIMA-HACCP-77',
    plant_name: 'Beneficio Andina',
    destination_market: 'HACCP',
    product_category: 'meat plant certification',
    approval_status: 'active',
  },
];

function sourceFor(id) {
  return RADAR_SOURCE_DEFINITIONS.find(source => source.id === id) || {
    id,
    country: '',
    url: '',
    retrieval: '',
    layer: 'factory_capability',
  };
}

function rowId(prefix, source, registration, name) {
  return `${prefix}-${slugify(source.id)}-${slugify(registration || name)}`;
}

function clean(value) {
  return compactSpaces(value);
}

function requireOfficialIdentity(record) {
  return clean(record.legal_name || record.plant_name || record.raw_company_name) &&
    clean(record.official_registration);
}

export function parseFactoryCapabilityRows({ source, records, collectedAt = todayIso() }) {
  return (records || [])
    .filter(requireOfficialIdentity)
    .map(record => {
      const legalName = clean(record.legal_name || record.raw_company_name || record.plant_name);
      const registration = clean(record.official_registration);
      return {
        capability_id: rowId('factory', source, registration, legalName),
        country: clean(record.country || source.country),
        official_registration: registration,
        legal_name: legalName,
        plant_name: clean(record.plant_name || normalizeCompanyName(legalName)),
        city: clean(record.city),
        region: clean(record.region),
        address: clean(record.address),
        activity_type: clean(record.activity_type || record.company_type),
        animal_species: clean(record.animal_species || record.species),
        operational_status: clean(record.operational_status || record.status || 'unknown'),
        export_markets: clean(record.export_markets),
        product_scope: clean(record.product_scope || record.description),
        byproduct_signal: clean(record.byproduct_signal),
        cold_chain_signal: clean(record.cold_chain_signal),
        source_id: source.id,
        source_url: clean(record.source_url || source.url),
        source_status: clean(record.source_status || 'usable'),
        confidence: clean(record.confidence || 'official'),
        collected_at: collectedAt,
        notes: clean(record.notes || source.retrieval),
      };
    });
}

export function parseSlaughterCapacityRows({ source, records, collectedAt = todayIso() }) {
  return (records || [])
    .filter(record => clean(record.official_registration) && Number(record.slaughter_head_count || 0) > 0)
    .map(record => ({
      capacity_id: rowId('capacity', source, record.official_registration, `${record.plant_name}-${record.period}`),
      country: clean(record.country || source.country),
      official_registration: clean(record.official_registration),
      plant_name: clean(record.plant_name),
      region: clean(record.region),
      period: clean(record.period),
      species: clean(record.species || 'bovine'),
      category: clean(record.category),
      slaughter_head_count: clean(record.slaughter_head_count),
      capacity_scope: clean(record.capacity_scope || 'unknown'),
      source_id: source.id,
      source_url: clean(record.source_url || source.url),
      confidence: clean(record.confidence || 'official'),
      collected_at: collectedAt,
      notes: clean(record.notes || source.retrieval),
    }));
}

export function parseExportApprovalRows({ source, records, collectedAt = todayIso() }) {
  return (records || [])
    .filter(record => clean(record.official_registration) && clean(record.destination_market))
    .map(record => ({
      approval_id: rowId('approval', source, record.official_registration, record.destination_market),
      country: clean(record.country || source.country),
      official_registration: clean(record.official_registration),
      plant_name: clean(record.plant_name),
      destination_market: clean(record.destination_market),
      product_category: clean(record.product_category),
      approval_status: clean(record.approval_status || record.status || 'unknown'),
      valid_from: clean(record.valid_from),
      valid_to: clean(record.valid_to),
      source_id: source.id,
      source_url: clean(record.source_url || source.url),
      confidence: clean(record.confidence || 'official'),
      collected_at: collectedAt,
      notes: clean(record.notes || source.retrieval),
    }));
}

export function fixtureRadarRows({ collectedAt = todayIso() } = {}) {
  const capabilities = [];
  const capacities = [];
  const approvals = [];
  for (const source of RADAR_SOURCE_DEFINITIONS) {
    capabilities.push(...parseFactoryCapabilityRows({
      source,
      records: fixtureFactories.filter(row => row.source_id === source.id),
      collectedAt,
    }));
    capacities.push(...parseSlaughterCapacityRows({
      source,
      records: fixtureCapacities.filter(row => row.source_id === source.id),
      collectedAt,
    }));
    approvals.push(...parseExportApprovalRows({
      source,
      records: fixtureApprovals.filter(row => row.source_id === source.id),
      collectedAt,
    }));
  }
  return { capabilities, capacities, approvals };
}

function capabilityFromAutoLead(row, collectedAt) {
  const registration = clean(row.official_registration);
  const name = clean(row.raw_company_name || row.normalized_company_name);
  if (!registration || !name) return null;
  const source = sourceFor(row.country === 'Paraguay' ? 'paraguay_senacsa_faena' : row.country === 'Uruguay' ? 'uruguay_inac_mgap' : '');
  if (!source.id) return null;
  return parseFactoryCapabilityRows({
    source,
    records: [{
      ...row,
      legal_name: name,
      product_scope: row.description,
      byproduct_signal: /menudencia|menudencias|visceras|miudos|subproductos/i.test(`${row.description} ${row.notes}`) ? row.description : '',
      source_url: row.url_or_file,
      confidence: 'official_auto_lead',
    }],
    collectedAt,
  })[0];
}

export async function collectRadarSources({
  fixture = false,
  autoLeadPath = 'data/auto-leads.tsv',
  collectedAt = todayIso(),
} = {}) {
  const rows = fixture ? fixtureRadarRows({ collectedAt }) : (() => {
    const { rows: autoLeads } = readTsv(autoLeadPath);
    return {
      capabilities: autoLeads.map(row => capabilityFromAutoLead(row, collectedAt)).filter(Boolean),
      capacities: [],
      approvals: [],
    };
  })();

  const countBySource = new Map();
  for (const row of [...rows.capabilities, ...rows.capacities, ...rows.approvals]) {
    countBySource.set(row.source_id, (countBySource.get(row.source_id) || 0) + 1);
  }

  const health = RADAR_SOURCE_DEFINITIONS.map(source => {
    const rowCount = countBySource.get(source.id) || 0;
    const supported = fixture || ['paraguay_senacsa_faena', 'uruguay_inac_mgap'].includes(source.id);
    return {
      source_id: source.id,
      country: source.country,
      layer: source.layer,
      status: rowCount ? 'usable' : supported ? 'no_structured_rows' : 'manual_required',
      retrieval: source.retrieval,
      row_count: String(rowCount),
      source_url: source.url,
      reason: rowCount ? 'OK' : supported ? 'No matched official capability rows' : 'Manual official export or parser required',
      collected_at: collectedAt,
    };
  });

  return { ...rows, health };
}

export function writeRadarCollectionOutputs({
  capabilities,
  capacities,
  approvals,
  health,
  factoryPath = 'data/factory-capabilities.tsv',
  capacityPath = 'data/slaughter-capacity.tsv',
  approvalPath = 'data/export-approvals.tsv',
  healthPath = 'data/radar-source-health.tsv',
}) {
  writeTsv(factoryPath, FACTORY_CAPABILITY_HEADERS, capabilities);
  writeTsv(capacityPath, SLAUGHTER_CAPACITY_HEADERS, capacities);
  writeTsv(approvalPath, EXPORT_APPROVAL_HEADERS, approvals);
  writeTsv(healthPath, RADAR_SOURCE_HEALTH_HEADERS, health);
}

export function radarSourceHealthSummary(health) {
  return (health || []).map(row => `${row.source_id} | ${row.status} | ${row.row_count} | ${row.reason}`).join('\n');
}
