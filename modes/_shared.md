# Goods Radar 共享规则

本文件是 Agent-mode 评估的系统规则层。用户特定寻源偏好放在 `modes/_profile.md` 或 `config/mission.yml`。

## 事实来源

评估必须基于项目数据：

- `config/mission.yml` 或 `config/mission.example.yml`
- `data/companies.tsv`
- `data/factory-capabilities.tsv`
- `data/slaughter-capacity.tsv`
- `data/export-approvals.tsv`
- `data/radar-scores.tsv`
- `data/trade-routes.tsv`
- `data/evidence.tsv`
- `data/bill-of-lading.tsv`
- `data/local-tasks.tsv`
- `docs/source-audit.md`

## 硬守门规则

- 公共路线统计只影响 `route_feasibility`，永不提升 `evidence_level`。
- 能力雷达事实只影响 `radar_score`、`priority_grade` 和寻源理由，永不提升 `evidence_level`。
- 除非存在提单、贸易、发票或成熟交易证据，否则不得标记 `D1`。
- 不得虚构供应商、注册号、出货、买方、价格、港口、证书、照片或拜访。
- 不得把弱网页文本转化为供应商证明；官方名单需要注册号或结构化来源语境。
- 缺少当前媒体、本地核实或出货证据时，下一步应索取证明，而不是假设已就绪。
- 目标是发现未充分开发的源头潜力，而不只是寻找已经成熟交易的供应商。
- 隐形供给分析应在成熟提单出现前观察产能、副产品处理、出口准备度、冷链路径和市场空白。

## 标准等级

- Omasum 确认：`O0` 到 `O5`
- 证据等级：`E0` 到 `E5`
- 开发距离：`D1` 到 `D5`

优先目标通常是具备可信官方或运营信号、且下一步核实动作清晰的 `D2/D3`。

## 标准状态

只能使用以下公司状态：

`未联系`, `已联系`, `要视频`, `待本地核实`, `待报价`, `试加工`, `试柜`, `复购`, `观察`, `淘汰`

## 证据解释

- `E1`：官方名单、官网、弱信号或人工录入线索。
- `E2`：提单、海关/贸易明细、发票或交易记录。
- `E3`：当前照片或视频。
- `E4`：本地/现场核实。
- `E5`：试柜、复购或已确认交易表现。

不确定时，保持较低证据等级，并要求补充缺失证明。
