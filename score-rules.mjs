#!/usr/bin/env node
import { formatRuleScoreSummary, runRuleScore } from './lib/rule-score.mjs';

const dryRun = process.argv.includes('--dry-run');
const result = runRuleScore({ dryRun });
console.log(formatRuleScoreSummary(result));
if (dryRun) console.log('Dry run：规则基线未写入。');
