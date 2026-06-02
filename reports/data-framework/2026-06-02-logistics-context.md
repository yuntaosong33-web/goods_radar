# Goods Radar 物流背景

日期：2026-06-02

写入范围：reports_only

背景范围：logistics_macro_context

## 1. 统计概览

| 指标 | 数量 |
| --- | --- |
| 物流背景行 | 12 |
| 国家数 | 6 |
| 指标数 | 2 |
| 受阻源 | 0 |

## 2. World Bank 物流背景

| 国家 | 代码 | 指标 | 名称 | 年份 | 数值 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| Brazil | BRA | LP.LPI.OVRL.XQ | Logistics performance index: Overall (1=low to 5=high) | 2022 | 3.2 | logistics_context_only |
| Brazil | BRA | IS.SHP.GOOD.TU | Container port traffic (TEU: 20 foot equivalent units) | 2022 | 11683239 | logistics_context_only |
| Paraguay | PRY | LP.LPI.OVRL.XQ | Logistics performance index: Overall (1=low to 5=high) | 2022 | 2.7 | logistics_context_only |
| Paraguay | PRY | IS.SHP.GOOD.TU | Container port traffic (TEU: 20 foot equivalent units) | 2020 | 37901.25 | logistics_context_only |
| Uruguay | URY | LP.LPI.OVRL.XQ | Logistics performance index: Overall (1=low to 5=high) | 2022 | 3 | logistics_context_only |
| Uruguay | URY | IS.SHP.GOOD.TU | Container port traffic (TEU: 20 foot equivalent units) | 2022 | 1080445 | logistics_context_only |
| Argentina | ARG | LP.LPI.OVRL.XQ | Logistics performance index: Overall (1=low to 5=high) | 2022 | 2.8 | logistics_context_only |
| Argentina | ARG | IS.SHP.GOOD.TU | Container port traffic (TEU: 20 foot equivalent units) | 2022 | 1667161 | logistics_context_only |
| Chile | CHL | LP.LPI.OVRL.XQ | Logistics performance index: Overall (1=low to 5=high) | 2022 | 3 | logistics_context_only |
| Chile | CHL | IS.SHP.GOOD.TU | Container port traffic (TEU: 20 foot equivalent units) | 2022 | 4158260 | logistics_context_only |
| Colombia | COL | LP.LPI.OVRL.XQ | Logistics performance index: Overall (1=low to 5=high) | 2022 | 2.9 | logistics_context_only |
| Colombia | COL | IS.SHP.GOOD.TU | Container port traffic (TEU: 20 foot equivalent units) | 2022 | 4480670 | logistics_context_only |

## 3. 数据源状态

| 数据源 | 状态 | 行数 | 原因 |
| --- | --- | --- | --- |
| world_bank-BRA-LP.LPI.OVRL.XQ | collected | 1 | OK |
| world_bank-BRA-IS.SHP.GOOD.TU | collected | 1 | OK |
| world_bank-PRY-LP.LPI.OVRL.XQ | collected | 1 | OK |
| world_bank-PRY-IS.SHP.GOOD.TU | collected | 1 | OK |
| world_bank-URY-LP.LPI.OVRL.XQ | collected | 1 | OK |
| world_bank-URY-IS.SHP.GOOD.TU | collected | 1 | OK |
| world_bank-ARG-LP.LPI.OVRL.XQ | collected | 1 | OK |
| world_bank-ARG-IS.SHP.GOOD.TU | collected | 1 | OK |
| world_bank-CHL-LP.LPI.OVRL.XQ | collected | 1 | OK |
| world_bank-CHL-IS.SHP.GOOD.TU | collected | 1 | OK |
| world_bank-COL-LP.LPI.OVRL.XQ | collected | 1 | OK |
| world_bank-COL-IS.SHP.GOOD.TU | collected | 1 | OK |

## 4. 管理动作

- 使用物流背景比较出口处理能力基础，并辅助路线可行性检查。
- 未发现物流背景源阻塞。
- 物流背景行仅作为宏观背景，永远不提升供应商证据。

## 5. 硬守门规则

- 物流背景只用于宏观判断。
- 物流背景可以丰富路线可行性和触达顺序。
- 物流背景不提升供应商证据。
- D1 必须有提单、发票、贸易或成熟交易证据。
