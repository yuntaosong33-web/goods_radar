# Goods Radar 数据需求与数据源扩展

日期：2026-06-02

写入范围：reports_only

## 1. 当前覆盖

项目当前已经覆盖以下数据层：

| 层级 | 当前来源/数据 | 当前用途 | 证据守门 |
| --- | --- | --- | --- |
| 供应商身份 | Uruguay Meats 出口商卡片、现有 `data/companies.tsv` | 供应商发现与官方身份确认 | 仅证明官方身份，通常仍为 E1 |
| 能力雷达 | staging `factory-capabilities.tsv`、现有雷达表 | radar score、priority grade、核实理由 | 永不提升证据等级 |
| 路线信号 | Brazil Comex Stat HS 0504 汇总 | 路线可行性和国家路线背景 | 永不提升证据等级 |
| 国家宏观背景 | World Bank 国家指标 | 国家供给背景与优先级解释 | 永不提升证据等级 |
| 物流背景 | World Bank LPI 与港口吞吐指标 | 路线可行性、触达顺序和商业可行性解释 | 永不提升证据等级 |
| P0 工作流 | intake、draft、import-plan 报告 | 证据、联系人、报价、任务、试柜的运营闭环 | 未经显式受控导入不得写业务表 |

## 2. 本轮新增真实数据源

| 数据源 | 输出 | 行数 | 管理价值 | 限制 |
| --- | --- | --- | --- | --- |
| World Bank Open Data API | `reports/data-framework/staging/2026-06-02-live-smoke/country-context.tsv` | 12 | 补充 6 个目标国家的畜牧与食品生产背景 | 国家级背景，不是供应商证据 |
| World Bank Open Data API | `reports/data-framework/staging/2026-06-02-live-smoke/logistics-context.tsv` | 12 | 补充 6 个目标国家的物流绩效与港口吞吐背景 | 国家级背景，不是供应商证据 |

这些行已用于丰富 `source-evaluations.tsv`：

- `country_context_score`
- `country_context_signal`
- `logistics_context_score`
- `logistics_context_signal`

以乌拉圭候选为例，当前可见背景信号包括：

- `AG.PRD.LVSK.XD 2022=109.58`
- `AG.PRD.FOOD.XD 2022=97.82`
- `LP.LPI.OVRL.XQ 2022=3`
- `IS.SHP.GOOD.TU 2022=1080445`

## 3. 最高优先级缺失数据

| 优先级 | 缺失数据 | 为什么重要 | 建议来源路径 | 写入目标 |
| --- | --- | --- | --- | --- |
| P0 | 当前批次 omasum 媒体与文件 | 只有它能把“官方身份”推进到真实产品确认 | 供应商 WhatsApp/视频、本地核实、买方团队上传 | 受控导入后的 `data/evidence.tsv` |
| P0 | 联系人与决策路径 | 把官方名单行转化为可执行开发任务 | WhatsApp、邮箱、本地核实、展会/官网联系页 | `data/contacts.tsv` |
| P0 | 报价与 QC 事实 | 判断是否能按采购标准加工、包装和出货 | 供应商报价、包装照片、Incoterm、港口、周供货量 | `data/quotes.tsv` |
| P0 | 试柜或样品批结果 | 闭合开发链路，验证损耗、扣重、复购和利润 | 试柜、加工试验、买方反馈 | `data/trials.tsv` |
| P1 | 工厂级屠宰/产能 | 区分真实上游工厂和名单型出口商 | INAC faena、SENACSA faena、农业开放数据 | `data/slaughter-capacity.tsv` 或 staging |
| P1 | 目的国/产品出口批准 | 识别 China/HK/Vietnam 等路径的出口准备度 | GACC/CIFER、SENACSA habilitados、SAG/LEEPP、SENASA、MAPA | `data/export-approvals.tsv` 或 staging |
| P1 | 交易/运输参考 | 只有这类数据能支撑 D1 成熟交易参考 | 提单、海关/贸易数据库、买方历史记录 | `data/bill-of-lading.tsv` |
| P2 | 港口/冷链/运费成本 | 提升路线可行性与商业可行性判断 | 船期、货代报价、冷柜可得性 | 后续 `route_cost` 或 quote notes |
| P2 | 本地副产品需求信号 | 识别被低估或本地分流的副产品流 | 本地价格、renderers、宠物食品/副产品加工商 | 后续 weak-signal staging |

## 4. 下一步数据源扩展

1. INAC/SENACSA 工厂级屠宰与 faena 数据  
   这是下一步最有价值的公共源增强，因为它能提供供应商或工厂产能信号；它只能提升雷达分和开发优先级，不能提升证据等级。

2. GACC/CIFER 或目的国审批名单  
   这能增强 China/HK/Vietnam 路径的出口准备度评分，但没有交易证据时仍不能产生 D1。

3. 买方自有与本地核实 P0 采集  
   这是把真实供应商从 E1 官方身份推进到 E3/E4 当前批次证据和实际采购决策的唯一主路径。

4. 付费或买方提供的提单/海关数据  
   这不是发现供应商的前置条件，但若要形成 D1 成熟交易参考，它是必要数据。

## 5. 管理结论

系统现在已经支持：

- 真实数据源采集；
- staging 审核；
- 供应商初步评估；
- 国家宏观背景增强；
- 物流背景增强；
- P0 intake/draft/import-plan 工作流；
- 数据运营总览报告。

当前限制因素不是代码结构，而是已核实的 P0 业务数据：当前批次证据、联系人、报价、本地核实和试柜结果。

硬守门规则保持不变：

- 路线统计不提升证据；
- 能力雷达事实不提升证据；
- 国家宏观背景不提升证据；
- 物流背景不提升证据；
- D1 需要提单、发票、贸易或成熟交易证据。
