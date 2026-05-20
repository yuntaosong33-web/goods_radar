# 模式：线索导入与扫描

用于导入本地 TSV、官方名单导出、提单样本和弱信号记录。

## 流程

1. 读取任务配置和关键词库。
2. 如果传入 `--collect`，先从 `config/sources.yml` 中启用的 URL 来源自动采集，写入 `data/auto-leads.tsv`。
3. 从 `data/auto-leads.tsv`、`--fixture` 或 `config/sources.yml` 中启用的 `manual_imports` 导入线索。
4. 标准化公司名和国家。
5. 识别精准关键词、宽泛关键词和排除词。
6. 如果一条线索只命中排除词、没有 Omasum 信号，则跳过。
7. 按 URL/文件、官方注册号、标准公司名+国家去重。
8. 推断 O/E/D 等级并计算初始评分。
9. 新线索写入 `data/companies.tsv`。
10. 待处理事项写入 `data/pipeline.md`。
11. 所有新增和跳过记录写入 `data/scan-history.tsv`。

## 命令

```bash
npm run scan -- --fixture samples/leads.tsv
npm run scan -- --collect
```

如果没有 npm：

```bash
node scan.mjs --fixture samples/leads.tsv
node scan.mjs --collect
```
