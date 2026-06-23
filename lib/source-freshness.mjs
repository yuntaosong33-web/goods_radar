function parseDate(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time) : null;
}

function daysBetween(now, then) {
  return Math.floor((now.getTime() - then.getTime()) / 86400000);
}

function latestBySource(rows = []) {
  const map = new Map();
  for (const row of rows) {
    const id = row.source_id;
    if (!id) continue;
    const existing = map.get(id);
    if (!existing || String(row.collected_at || '') >= String(existing.collected_at || '')) {
      map.set(id, row);
    }
  }
  return map;
}

function statusFor({ latest, nowDate, staleDays }) {
  if (!latest) return ['never_collected', '', '运行采集器或补充 provider'];
  if (latest.status && latest.status !== 'collected' && latest.status !== 'usable') {
    return ['error', latest.status, '检查来源或解析器'];
  }
  const date = parseDate(latest.collected_at);
  if (!date) return ['error', latest.status || '', '缺少 collected_at'];
  const age = daysBetween(nowDate, date);
  if (age > staleDays) return ['stale', latest.status || '', '刷新来源或检查解析器'];
  return ['current', latest.status || '', '保持定期采集'];
}

export function buildSourceFreshnessModel({
  configuredSources = [],
  collectionHistory = [],
  radarHealth = [],
  now = new Date().toISOString().slice(0, 10),
  staleDays = 30,
} = {}) {
  const nowDate = parseDate(now) || new Date();
  const latest = latestBySource([
    ...collectionHistory,
    ...radarHealth.map(row => ({
      ...row,
      collected_at: row.collected_at,
      status: row.status === 'usable' ? 'collected' : row.status,
      lead_count: row.row_count,
    })),
  ]);
  const rows = configuredSources.map(source => {
    const item = latest.get(source.id);
    const [freshnessStatus, lastStatus, nextAction] = statusFor({ latest: item, nowDate, staleDays });
    const lastDate = item?.collected_at || '';
    const age = lastDate && parseDate(lastDate) ? String(daysBetween(nowDate, parseDate(lastDate))) : '';
    return {
      source_id: source.id,
      label: source.label || source.id,
      group: source.group || '',
      enabled: source.enabled === false ? 'false' : 'true',
      freshness_status: freshnessStatus,
      last_collected_at: lastDate,
      last_status: lastStatus,
      row_count: item?.lead_count || item?.row_count || '',
      age_days: age,
      next_action: nextAction,
    };
  });
  const summary = rows.reduce((acc, row) => {
    acc[row.freshness_status] = (acc[row.freshness_status] || 0) + 1;
    return acc;
  }, { current: 0, stale: 0, error: 0, never_collected: 0 });
  return { rows, summary, staleDays, now };
}

function table(rows) {
  const headers = ['来源 ID', '状态', '最近采集', '间隔天数', '下一步'];
  const statusLabel = {
    current: '当前可用',
    stale: '已过期',
    error: '异常',
    never_collected: '从未采集',
  };
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.source_id} | ${statusLabel[row.freshness_status] || row.freshness_status} | ${row.last_collected_at || '-'} | ${row.age_days || '-'} | ${row.next_action} |`),
  ].join('\n');
}

export function renderSourceFreshnessReport({ date, model }) {
  return [
    `# Goods Radar 来源新鲜度 - ${date}`,
    '',
    `过期阈值：${model.staleDays} 天。`,
    '',
    `- 当前可用：${model.summary.current || 0}`,
    `- 已过期：${model.summary.stale || 0}`,
    `- 异常：${model.summary.error || 0}`,
    `- 从未采集：${model.summary.never_collected || 0}`,
    '',
    table(model.rows),
    '',
    '来源新鲜度只描述来源维护状态，不提升供应商证据等级。',
  ].join('\n');
}
