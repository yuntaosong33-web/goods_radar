# Goods Radar Codex Prompt 归档

日期：2026-05-21

写入范围：reports_only

## 说明

这是一份历史 dry-run prompt 归档。当前项目要求所有报告和输出内容使用中文，因此本文件保留关键评估上下文，不再保留旧版英文完整提示词。

## 评估规则摘要

- 只输出 JSON assessment 数组。
- 必须包含 source_id、score、omasum_level、evidence_level、development_distance、route_feasibility、risk_flags、status、next_action、rationale、citations、report_markdown。
- 不得虚构供应商、出货、注册号、价格、买方、港口或产品事实。
- 公共贸易路线只能影响 route_feasibility，不能提升 evidence_level。
- 能力雷达只能影响 radar_score、priority_grade 和寻源理由，不能提升 evidence_level，也不能创建 D1。
- 除非存在提单、贸易、发票或成熟交易证据，否则不得设置 D1。
- report_markdown 必须为中文 A-G 寻源评估报告。

## 案例摘要

| 字段 | 内容 |
| --- | --- |
| source_id | py-senacsa-001 |
| 公司 | A Frigorifico Paraguay |
| 国家 | Paraguay |
| 官方注册 | SENACSA-001 |
| 初始等级 | O3/E1/D2 |
| 路线可行性 | medium |
| 证据上限 | E4 |
| D1 守门 | 不允许，缺少提单/贸易证据 |
| 雷达分 | 40 |
| 优先级 | D |
| 关键不确定性 | 需要确认 omaso bovino / librillo 是否可收集 |
| 下一步 | 询问月屠宰量或收集量，并确认 omasum 是厂内处理还是由 triperia 处理 |

## 硬守门提醒

- 路线统计不提升证据。
- 能力雷达不提升证据。
- D1 需要交易证据。
- 当前 prompt 归档不得作为业务事实导入 data/*。
