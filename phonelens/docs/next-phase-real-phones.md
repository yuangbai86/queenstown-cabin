# 下一阶段：补入两款真实手机

目标：用两款价格接近、都有中国大陆 256GB 版本的真实机型替换演示样板，跑通“参数 + 价格 + 评论 + 分析”的完整流程。以下每一项都需要人工核验，不能用模型记忆或二手转载填写。

## 1. 选型前确认

| 检查项 | 记录方式 | 写入位置 |
| --- | --- | --- |
| 官网是否在售（参数页存在不等于在售） | 截图日期 + 页面链接 | `phones.json` 的 `sale_status`、`verified_at` |
| 是否有 256GB 版本，RAM 组合 | 官网购买页 | `phones.json` 的 `storage`、`ram` |
| 地区：中国大陆官方版本 | 官网域名 | `region` |
| 两款价格是否接近（相差不超过较低价 30% 更适合样板） | 官方当前售价 | `prices.json` |

## 2. 参数字段（`data/templates/specs_template.csv`）

每个字段一行，记录来源编号与核验日期；官网未列出填 `官网未列出`，不要估算。

| 字段 `field` | 单位 | 说明 |
| --- | --- | --- |
| `chip` | — | 官网写法原样记录 |
| `ram_gb` | GB | 256GB 版本对应的 RAM |
| `os` | — | 出厂系统名称与版本 |
| `weight_g` | g | 注意不同颜色/材质重量可能不同，在 `note` 写明 |
| `height_mm` / `width_mm` / `thickness_mm` | mm | 同上 |
| `ip_rating` | — | 如 IP68 |
| `display_size_in` | 英寸 | |
| `display_refresh_hz` | Hz | 最高刷新率 |
| `battery_mah` | mAh | 写明“典型值/额定值”口径；Apple 通常不标注容量，填 `官网未列出` |
| `wired_charging_w` / `wireless_charging_w` | W | 厂商测试条件写在 `note` |
| `rear_camera_count` / `main_camera_mp` / `front_camera_mp` | 颗 / MP | |
| `telephoto` | — | 如“3 倍长焦”或“无” |

## 3. 价格（`data/templates/prices_template.csv`）

- `price_type` 只用三种：`official_current`（核验到当前售价）、`official_msrp`（建议零售价）、`user_reported`。
- 建议零售价不能改名为现价；补贴、换新、分期条件写在 `conditions`。
- 每条记录 `recorded_at`，价格变化时新增记录并提升 `meta.json` 的 `price_version`。

## 4. 来源登记（`data/templates/sources_template.csv`）

每个来源一行：获取方式、允许保存的范围、允许展示的范围（`full_text` / `excerpt` / `summary_only` / `none`）、确认依据。官网参数来源的 `verification` 在人工核对后改为 `human_verified`。

## 5. 评论模板（`data/templates/reviews_template.csv`）

```
phone_id,text,source_label,review_id,review_date,system_version,source_url
```

- 只收录**来源与使用范围明确**的评论：本人或朋友授权提供的使用反馈、明确允许保存与展示的数据。网页能打开不等于允许批量复制和再分发。
- `review_date` 用 YYYY-MM-DD；`system_version` 不知道就留空（页面会显示“未知”，不推断为最新系统）。
- 每款 30–50 条有效评论是演示准备目标，不是统计代表性保证；拿不到就保持“仅参数”。
- 写入 `data/v1/reviews.json` 时 `data_kind` 设为 `real`，`source_id` 指向已登记来源。

## 6. 标注与审核

1. 运行批量标注（见下方配置），生成 `local-data/labels-draft.json`。
2. 人工逐条检查：维度是否正确、情绪是否正确、摘录是否支持判断；不确定的标 `needs_review`。
3. 重复、广告、机型混入、无内容样本在 `audit.json` 记录排除原因。
4. 合并进 `analysis.json`，填写 `reviewed_by`，提升 `label_version`。
5. 抽出至少 60 条（不足按实有）做评估，见 `docs/evaluation-template.md`。

## 7. 配置清单

| 项目 | 是否必需 | 说明 |
| --- | --- | --- |
| 本地批量标注：`AI_ENABLED=true`、`AI_PROVIDER`、`AI_API_KEY`、`AI_MODEL`、`AI_ALLOW_LOCAL_WITHOUT_QUOTA=true`、`NODE_ENV=development` | 标注时必需 | 只在本机运行，不进仓库 |
| 线上基础模式 | 无需任何变量 | 当前部署方式 |
| 线上启用模型解释：`AI_ENABLED`、`AI_API_KEY`、`AI_MODEL`、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`、`AI_DAILY_QUOTA`、`AI_RATE_LIMIT_PER_IP` | 可选 | 缺少共享存储时服务端拒绝付费调用 |
| `meta.json` 版本号 | 必需 | 改数据提升 `data_version`，改标注提升 `label_version`，改价格提升 `price_version`，避免缓存串用 |

## 8. 发布前检查

```bash
npm run validate-data   # 真实参数有数值但来源未人工核验会报错
npm run check           # 类型检查、测试、数据检查、构建
```

然后在结果页逐条点开“查看依据”，确认每个数字都能追溯到参数记录或评论。
