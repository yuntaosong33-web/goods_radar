const COUNTRY_LABELS = {
  Brazil: '巴西',
  Paraguay: '巴拉圭',
  Uruguay: '乌拉圭',
  Argentina: '阿根廷',
  Colombia: '哥伦比亚',
};

const COMPANY_TYPE_LABELS = {
  frigorifico: '肉厂/屠宰场',
  frigorífico: '肉厂/屠宰场',
  slaughterhouse: '屠宰场',
  abattoir: '屠宰场',
  matadero: '屠宰场',
  abatedouro: '屠宰场',
  byproduct_processor: '副产品加工商',
  processor: '加工商',
  exporter: '出口商',
  meat_exporter: '肉类出口商',
  cold_storage: '冷库',
  trader: '贸易商',
  export_agent: '出口代理',
  unknown: '未知类型',
};

const SOURCE_TYPE_LABELS = {
  official_list: '官方名单',
  weak_signal: '弱信号',
  bill_of_lading: '提单/成熟样本',
  manual_tsv: '人工导入',
  trade_data: '贸易数据',
  local_feedback: '本地反馈',
};

export function countryLabel(country) {
  return COUNTRY_LABELS[country] || country || '未知国家';
}

export function companyTypeLabel(type) {
  return COMPANY_TYPE_LABELS[type] || type || '未知类型';
}

export function sourceTypeLabel(type) {
  return SOURCE_TYPE_LABELS[type] || type || '未知来源';
}

export function formatScore(score) {
  return `${score || 0}/100`;
}

export function formatLevels(row) {
  return `${row.omasum_level || 'O?'} / ${row.evidence_level || 'E?'} / ${row.development_distance || 'D?'}`;
}

export function formatPipelineLine(lead) {
  const summary = [
    `编号：${lead.source_id}`,
    `公司：${lead.normalized_company_name}`,
    `国家：${countryLabel(lead.country)}`,
    `类型：${companyTypeLabel(lead.company_type)}`,
    `等级：${formatLevels(lead)}`,
    `评分：${formatScore(lead.score)}`,
  ].join(' | ');
  return `${summary}\n  - 动作：${lead.next_action}\n  - 来源：${lead.url_or_file || '无'}`;
}
