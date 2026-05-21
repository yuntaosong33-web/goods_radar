import { existsSync, mkdirSync } from 'fs';
import {
  AUTO_LEAD_HEADERS,
  BILL_OF_LADING_HEADERS,
  COLLECTION_HISTORY_HEADERS,
  COMPANY_HEADERS,
  EVIDENCE_HEADERS,
  EXPORT_APPROVAL_HEADERS,
  FACTORY_CAPABILITY_HEADERS,
  LLM_EVALUATION_HEADERS,
  LOCAL_TASK_HEADERS,
  RADAR_SCORE_HEADERS,
  RADAR_SOURCE_HEALTH_HEADERS,
  SCAN_HISTORY_HEADERS,
  SLAUGHTER_CAPACITY_HEADERS,
  TRADE_ROUTE_HEADERS,
  TRADE_ROUTE_HISTORY_HEADERS,
} from './constants.mjs';
import { ensureTsv } from './tsv.mjs';

export function ensureProjectFiles() {
  for (const dir of ['.agents', '.agents/skills', '.agents/skills/goods-radar', 'config', 'data', 'lib', 'modes', 'reports', 'reports/evaluations', 'reports/llm-evaluations', 'reports/weekly', 'samples']) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  ensureTsv('data/companies.tsv', COMPANY_HEADERS);
  ensureTsv('data/auto-leads.tsv', AUTO_LEAD_HEADERS);
  ensureTsv('data/collection-history.tsv', COLLECTION_HISTORY_HEADERS);
  ensureTsv('data/trade-routes.tsv', TRADE_ROUTE_HEADERS);
  ensureTsv('data/trade-route-history.tsv', TRADE_ROUTE_HISTORY_HEADERS);
  ensureTsv('data/bill-of-lading.tsv', BILL_OF_LADING_HEADERS);
  ensureTsv('data/factory-capabilities.tsv', FACTORY_CAPABILITY_HEADERS);
  ensureTsv('data/slaughter-capacity.tsv', SLAUGHTER_CAPACITY_HEADERS);
  ensureTsv('data/export-approvals.tsv', EXPORT_APPROVAL_HEADERS);
  ensureTsv('data/radar-scores.tsv', RADAR_SCORE_HEADERS);
  ensureTsv('data/radar-source-health.tsv', RADAR_SOURCE_HEALTH_HEADERS);
  ensureTsv('data/evidence.tsv', EVIDENCE_HEADERS);
  ensureTsv('data/llm-evaluations.tsv', LLM_EVALUATION_HEADERS);
  ensureTsv('data/local-tasks.tsv', LOCAL_TASK_HEADERS);
  ensureTsv('data/scan-history.tsv', SCAN_HISTORY_HEADERS);
  ensureTsv('data/contacts.tsv', [
    'contact_id',
    'company_key',
    'normalized_company_name',
    'contact_name',
    'role',
    'whatsapp',
    'email',
    'language',
    'relationship_source',
    'trust_level',
    'last_summary',
    'next_questions',
  ]);
  ensureTsv('data/quotes.tsv', [
    'quote_id',
    'company_key',
    'normalized_company_name',
    'product_original',
    'ai_product_classification',
    'form',
    'packaging',
    'weekly_volume',
    'price',
    'incoterm',
    'port',
    'payment_terms',
    'can_process_to_standard',
    'can_supervise_processing',
    'commercial_assessment',
    'risk',
    'quoted_at',
  ]);
  ensureTsv('data/trials.tsv', [
    'trial_id',
    'company_key',
    'normalized_company_name',
    'country',
    'product',
    'quantity_mt',
    'packaging',
    'price',
    'processing_method',
    'supervisor',
    'arrival_quality',
    'actual_loss_percent',
    'deduction_reason',
    'actual_margin',
    'repurchase',
    'trial_conclusion',
    'date',
  ]);
}
