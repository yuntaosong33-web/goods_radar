const STRUCTURED_NOTE_PATTERN = /结构化解析|structured parse|Google Sheets|exporter card/i;

export function autoLeadProvenanceIssues(row) {
  const issues = [];
  const url = String(row.url_or_file || '').trim();
  const sourceType = String(row.source_type || '').trim();
  const registration = String(row.official_registration || '').trim();
  const notes = String(row.notes || '');

  if (!url) {
    issues.push('url_or_file is required for auto-collected rows');
  } else if (!/^https?:\/\//i.test(url)) {
    issues.push('url_or_file must be an http(s) source URL');
  } else if (/example\.local/i.test(url)) {
    issues.push('url_or_file points to placeholder example.local');
  }

  if (sourceType === 'official_list') {
    if (!registration) issues.push('official_list row missing official_registration');
    if (!STRUCTURED_NOTE_PATTERN.test(notes)) issues.push('auto official row lacks structured parsing note');
  }

  if (sourceType === 'bill_of_lading' && !/bill|lading|customs|trade|提单|单据/i.test(`${url} ${notes}`)) {
    issues.push('bill_of_lading row lacks bill/trade provenance marker');
  }

  return issues;
}

export function sourceAvailabilityRows() {
  return [
    {
      source_id: 'paraguay_senacsa_frigorificos',
      layer: '官方能力层',
      status: 'usable_structured',
      retrieval: 'SENACSA page -> public Google Sheets CSV export',
      evidence: 'official registration + processor name + destination classes',
    },
    {
      source_id: 'uruguay_meats_exporters',
      layer: '官方能力层',
      status: 'usable_structured',
      retrieval: 'Uruguay Meats exporter cards',
      evidence: 'INAC card number + product detail URL + company title',
    },
    {
      source_id: 'brazil_mapa_dipoa',
      layer: '官方能力层',
      status: 'gated_entry_only',
      retrieval: 'MAPA page is reachable, SIGSIF query rejects unauthenticated/scripted requests',
      evidence: 'entry page only; do not score page fragments as suppliers',
    },
    {
      source_id: 'brazil_mapa_sif_open_data',
      layer: 'official_capability_layer',
      status: 'official_capability_source',
      retrieval: 'MAPA/SIF open data export',
      evidence: 'official registration and animal product establishment capability',
    },
    {
      source_id: 'paraguay_senacsa_faena',
      layer: 'official_capability_layer',
      status: 'official_capability_source',
      retrieval: 'SENACSA frigorificos and faena/industrializacion files',
      evidence: 'official registration, destination class, and slaughter/capacity signal when plant-level matched',
    },
    {
      source_id: 'uruguay_inac_mgap',
      layer: 'official_capability_layer',
      status: 'official_capability_source',
      retrieval: 'MGAP DIA establishments and INAC faena files',
      evidence: 'official establishment and plant/month slaughter signal when matched',
    },
    {
      source_id: 'argentina_senasa_registros',
      layer: 'official_capability_layer',
      status: 'official_capability_source',
      retrieval: 'SENASA registros / establecimientos habilitados',
      evidence: 'official establishment capability',
    },
    {
      source_id: 'chile_sag_leepp',
      layer: 'official_capability_layer',
      status: 'official_capability_source',
      retrieval: 'SAG LEEPP export establishment lists',
      evidence: 'official export establishment capability',
    },
    {
      source_id: 'colombia_invima_carne',
      layer: 'official_capability_layer',
      status: 'official_capability_source',
      retrieval: 'INVIMA meat plant, HACCP, and operating status lists',
      evidence: 'official meat plant capability and certification status',
    },
    {
      source_id: 'un_comtrade',
      layer: '贸易流向层',
      status: 'api_key_required_route_signal_only',
      retrieval: 'UN Comtrade API with COMTRADE_API_KEY',
      evidence: 'country/HS route signal, not supplier identity',
    },
    {
      source_id: 'brazil_comex_stat',
      layer: 'trade_route_layer',
      status: 'api_connected_route_signal_only',
      retrieval: 'Comex Stat /general POST aggregate query for Brazil export routes',
      evidence: 'Brazil country/HS route signal, not supplier identity',
    },
    {
      source_id: 'wits',
      layer: '贸易流向层',
      status: 'api_available_route_signal_only',
      retrieval: 'World Bank WITS API',
      evidence: 'country/HS route cross-check, not supplier identity',
    },
    {
      source_id: 'faostat',
      layer: '贸易流向层',
      status: 'api_available_background_only',
      retrieval: 'FAOSTAT data/API',
      evidence: 'livestock/background data, not supplier identity',
    },
    {
      source_id: 'paid_bill_of_lading',
      layer: '贸易流向层',
      status: 'csv_xlsx_import_supported',
      retrieval: 'Panjiva/ImportGenius/other paid customs data exported as CSV/XLSX',
      evidence: 'supplier/buyer/shipment evidence only after user supplies export or credentials',
    },
    {
      source_id: 'google_maps_social_media',
      layer: '网络弱信号层',
      status: 'manual_or_api_terms_limited',
      retrieval: 'Maps/social APIs or manual export, subject to terms and login limits',
      evidence: 'weak discovery signal; must be upgraded with official/media/local proof',
    },
    {
      source_id: 'local_intelligence',
      layer: '本地情报层',
      status: 'manual_verification_required',
      retrieval: 'translator/forwarder/cold-storage/field reports',
      evidence: 'human-entered evidence with contact, date, media, and conclusion',
    },
    {
      source_id: 'internal_experience',
      layer: '内部经验层',
      status: 'user_owned_data_required',
      retrieval: '报价、试柜、照片和买方反馈记录在 data/*.tsv 中',
      evidence: 'internal transaction or QA record',
    },
  ];
}
