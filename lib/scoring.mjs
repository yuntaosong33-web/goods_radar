import {
  DEFAULT_BROAD_TERMS,
  DEFAULT_EXCLUDED_TERMS,
  DEFAULT_PRECISE_TERMS,
  RISK_RULES,
} from './constants.mjs';
import { asArray } from './config.mjs';
import {
  clamp,
  compactSpaces,
  findTerms,
  includesTerm,
  levelNumber,
  normalizeText,
  splitList,
} from './text.mjs';

function termsFromMission(mission, group) {
  if (group === 'precise') {
    return [
      ...DEFAULT_PRECISE_TERMS,
      ...asArray(mission?.product?.accepted_forms),
      ...asArray(mission?.product?.chinese_names),
      ...asArray(mission?.keywords?.precise),
    ];
  }
  if (group === 'broad') {
    return [
      ...DEFAULT_BROAD_TERMS,
      ...asArray(mission?.keywords?.broad),
      ...asArray(mission?.keywords?.weak_signals),
    ];
  }
  return [
    ...DEFAULT_EXCLUDED_TERMS,
    ...asArray(mission?.product?.excluded_products),
  ];
}

export function leadText(row) {
  const fields = [
    'source_id',
    'raw_company_name',
    'normalized_company_name',
    'country',
    'city',
    'company_type',
    'source_type',
    'url_or_file',
    'official_registration',
    'source_truth',
    'weekly_supply_potential',
    'undervaluation_signal',
    'processing_control',
    'route_feasibility',
    'communication_trust',
    'risk_flags',
    'description',
    'notes',
    'summary',
    'product_original',
    'path_or_url',
  ];
  return fields.map(field => String(row[field] ?? '')).join(' ');
}

export function detectKeywords(row, mission) {
  const text = leadText(row);
  const precise = findTerms(text, termsFromMission(mission, 'precise'));
  const broad = findTerms(text, termsFromMission(mission, 'broad'));
  const excluded = findTerms(text, termsFromMission(mission, 'excluded'));
  return { precise, broad, excluded };
}

export function inferOmasumLevel(row, mission) {
  const explicit = compactSpaces(row.omasum_level);
  if (/^O[0-5]$/i.test(explicit)) return explicit.toUpperCase();

  const text = leadText(row);
  const { precise, broad } = detectKeywords(row, mission);
  const evidenceSource = normalizeText(`${row.source_type} ${row.evidence_type}`);
  const normalizedText = normalizeText(text);
  const mediaSignal =
    /(video|photo|picture|current_media|照片|视频)/.test(evidenceSource) ||
    /received current video|current video received|收到当前视频|收到照片/.test(normalizedText);
  const fieldSignal = /site confirmed|现场确认|试柜|trial shipment|repeat purchase/.test(evidenceSource);

  if (fieldSignal && precise.length) return 'O5';
  if (mediaSignal && precise.length) return 'O4';
  if (precise.length) return 'O3';
  if (broad.some(term => /tripe|bucho|mondongo|panza|牛肚|毛肚/i.test(term))) return 'O2';
  if (broad.length) return 'O1';
  return 'O0';
}

export function inferEvidenceLevel(row) {
  const explicit = compactSpaces(row.evidence_level);
  if (/^E[0-5]$/i.test(explicit)) return explicit.toUpperCase();

  const evidenceSource = normalizeText(`${row.source_type} ${row.evidence_type}`);
  const fullText = normalizeText(`${row.source_type} ${row.evidence_type} ${row.description} ${row.notes}`);
  if (/repeat|repurchase|trial|试柜|复购/.test(evidenceSource)) return 'E5';
  if (/field|visit|local_feedback|现场|本地人/.test(evidenceSource)) return 'E4';
  if (
    /(video|photo|picture|current_media|照片|视频)/.test(evidenceSource) ||
    /received current video|current video received|收到当前视频|收到照片/.test(fullText)
  ) return 'E3';
  if (
    /(bill_of_lading|bill-of-lading|trade_data|customs|invoice|单据|提单|贸易记录)/.test(evidenceSource)
  ) return 'E2';
  if (/official|website|weak_signal|manual_tsv|官网|官方/.test(evidenceSource)) return 'E1';
  return 'E0';
}

export function inferDevelopmentDistance(row, omasumLevel, evidenceLevel) {
  const explicit = compactSpaces(row.development_distance);
  if (/^D[1-5]$/i.test(explicit)) return explicit.toUpperCase();

  const source = normalizeText(row.source_type);
  const type = normalizeText(row.company_type);
  const text = normalizeText(leadText(row));
  const o = levelNumber(omasumLevel, 'O');
  const e = levelNumber(evidenceLevel, 'E');

  if ((source.includes('bill') || source.includes('trade')) && o >= 3 && e >= 2) return 'D1';
  if (/(processor|byproduct|subproduct|subprodutos|cold_storage|cold storage|export_agent|export agent|加工|冷库)/.test(type)) return 'D3';
  if (/(frigorifico|frigorífico|slaughter|abattoir|matadero|abatedouro|meat_exporter|meat exporter)/.test(type)) return 'D2';
  if (/(frigorifico|frigorífico|slaughter|abattoir|matadero|abatedouro)/.test(text)) return 'D2';
  if (/(processor|byproduct|subproduct|subprodutos|cold_storage|cold storage|export_agent|export agent|加工|冷库)/.test(text)) return 'D3';
  if (/(trader|market|broker|local|贸易商|批发)/.test(`${type} ${text}`)) return 'D4';
  if (o === 0 && e === 0) return 'D5';
  return 'D3';
}

function qualitativeScore(value, max, fallback) {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (/high|yes|own|source|true|强|高|是|源头|自有/.test(text)) return max;
  if (/medium|partial|unknown|maybe|中|未知|不确定|部分/.test(text)) return max * 0.55;
  if (/low|no|false|弱|低|否|不能/.test(text)) return max * 0.2;
  const numeric = Number(text);
  if (!Number.isNaN(numeric)) return clamp(numeric, 0, max);
  return fallback;
}

function sourceTruthScore(row, max) {
  const explicit = qualitativeScore(row.source_truth, max, null);
  if (explicit !== null) return explicit;
  const type = normalizeText(row.company_type);
  if (/(frigorifico|slaughter|matadero|abatedouro)/.test(type)) return max;
  if (/(processor|byproduct|meat_exporter|exporter)/.test(type)) return max * 0.75;
  if (/(cold_storage|cold storage)/.test(type)) return max * 0.55;
  if (/(agent|trader|broker)/.test(type)) return max * 0.3;
  return max * 0.2;
}

function supplyScore(row, max) {
  const explicit = qualitativeScore(row.weekly_supply_potential, max, null);
  if (explicit !== null) return explicit;
  const type = normalizeText(row.company_type);
  if (/(frigorifico|slaughter|matadero|abatedouro)/.test(type)) return max * 0.75;
  if (/(processor|byproduct|exporter)/.test(type)) return max * 0.6;
  if (/(cold_storage|agent|trader)/.test(type)) return max * 0.35;
  return max * 0.25;
}

function undervaluationScore(row, max, developmentDistance) {
  const explicit = qualitativeScore(row.undervaluation_signal, max, null);
  if (explicit !== null) return explicit;
  const text = normalizeText(leadText(row));
  if (/pet food|rendering|local|subproductos|subprodutos|miudos|miudos|低值|本地|宠物/.test(text)) return max * 0.85;
  if (developmentDistance === 'D1') return max * 0.3;
  if (developmentDistance === 'D2' || developmentDistance === 'D3') return max * 0.6;
  return max * 0.35;
}

function processingScore(row, max) {
  const explicit = qualitativeScore(row.processing_control, max, null);
  if (explicit !== null) return explicit;
  const text = normalizeText(leadText(row));
  if (/wash|washed|salt|salted|pack|frozen|clean|清洗|盐腌|包装|冷冻/.test(text)) return max * 0.85;
  const type = normalizeText(row.company_type);
  if (/(processor|byproduct)/.test(type)) return max * 0.65;
  if (/(frigorifico|slaughter)/.test(type)) return max * 0.45;
  return max * 0.25;
}

function routeScore(row, max) {
  const explicit = qualitativeScore(row.route_feasibility, max, null);
  if (explicit !== null) return explicit;
  const text = normalizeText(leadText(row));
  if (/hai phong|hong kong|vietnam|40rq|export|fcl|海防|香港|越南/.test(text)) return max;
  if (/port|cold storage|出口|港/.test(text)) return max * 0.55;
  return max * 0.25;
}

function communicationScore(row, max) {
  return qualitativeScore(row.communication_trust, max, max * 0.45);
}

export function detectRiskFlags(row) {
  const text = `${row.risk_flags ?? ''} ${leadText(row)}`;
  const found = [];
  const seen = new Set();
  for (const rule of RISK_RULES) {
    if (rule.terms.some(term => includesTerm(text, term))) {
      if (!seen.has(rule.id)) {
        seen.add(rule.id);
        found.push(rule.id);
      }
    }
  }
  return found;
}

export function riskPenalty(flags) {
  const ids = new Set(splitList(flags).map(item => normalizeText(item)));
  let total = 0;
  for (const rule of RISK_RULES) {
    if (ids.has(rule.id)) total += rule.penalty;
  }
  return total;
}

export function recommendAction({ score, omasumLevel, evidenceLevel, developmentDistance }) {
  const o = levelNumber(omasumLevel, 'O');
  const e = levelNumber(evidenceLevel, 'E');
  if (score < 40 || developmentDistance === 'D5') return '淘汰：证据不足或风险过高';
  if (developmentDistance === 'D1') return '成熟参考：记录价格、包装、路线，少量验证';
  if (o >= 3 && e >= 2 && ['D2', 'D3'].includes(developmentDistance)) {
    return '重点推进：联系负责人，要当前视频并安排本地核实';
  }
  if (developmentDistance === 'D4') return '小比例探索：先电话确认原料和冷链';
  if (o < 3) return '补证据：确认是否为 omasum / omaso / librillo / folhoso';
  if (e < 3) return '要视频：索取当前原料、清洗、盐腌、包装和冷库视频';
  return '观察：补充证据后重新评分';
}

export function recommendStatus({ score, omasumLevel, evidenceLevel, developmentDistance }) {
  const o = levelNumber(omasumLevel, 'O');
  const e = levelNumber(evidenceLevel, 'E');
  if (score < 40 || developmentDistance === 'D5') return '淘汰';
  if (developmentDistance === 'D1') return '观察';
  if (o >= 3 && e >= 2 && ['D2', 'D3'].includes(developmentDistance)) return '待本地核实';
  if (o >= 3 && e < 3) return '要视频';
  return '未联系';
}

export function scoreLead(row, mission) {
  const omasumLevel = inferOmasumLevel(row, mission);
  const evidenceLevel = inferEvidenceLevel(row);
  const developmentDistance = inferDevelopmentDistance(row, omasumLevel, evidenceLevel);
  const o = levelNumber(omasumLevel, 'O');
  const e = levelNumber(evidenceLevel, 'E');

  const components = {
    omasum_confirmation: (o / 5) * 25,
    source_truth: sourceTruthScore(row, 20),
    weekly_supply_potential: supplyScore(row, 15),
    undervaluation_signal: undervaluationScore(row, 15, developmentDistance),
    processing_control: processingScore(row, 10),
    route_feasibility: routeScore(row, 5),
    evidence_strength: (e / 5) * 5,
    communication_trust: communicationScore(row, 5),
  };

  const riskFlags = detectRiskFlags(row);
  const penalty = riskPenalty(riskFlags.join(';'));
  const raw = Object.values(components).reduce((sum, value) => sum + value, 0) - penalty;
  const score = Math.round(clamp(raw, 0, 100));
  const nextAction = recommendAction({ score, omasumLevel, evidenceLevel, developmentDistance });
  const status = recommendStatus({ score, omasumLevel, evidenceLevel, developmentDistance });

  return {
    omasumLevel,
    evidenceLevel,
    developmentDistance,
    riskFlags,
    riskPenalty: penalty,
    components,
    score,
    nextAction,
    status,
  };
}
