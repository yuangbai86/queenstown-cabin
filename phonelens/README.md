# PhoneLens 手机对比助手

帮正在两款手机之间犹豫的人，结合预算和使用偏好看懂：更值得考虑哪款、要接受什么取舍、判断来自哪些参数和评论、哪些地方证据不足。

> **当前状态（2026-11-20）**：完整流程可以在本地运行，但**内置数据全部是演示夹具**。开发环境无法访问 Apple、小米、vivo 官网，真实机型只登记了型号，参数显示“尚未核验”，没有真实价格和真实评论。详见 [`docs/data-gaps.md`](docs/data-gaps.md)。

## 快速开始

需要 Node.js 20 或更高版本。

```bash
cd phonelens
npm ci
npm run dev
```

打开 <http://localhost:3000>。不配置任何环境变量时运行“基础模式”：比较、推荐、证据面板、导入清洗都可用，只是不调用模型。

常用命令：

| 命令 | 作用 |
| --- | --- |
| `npm run check` | 类型检查 + 测试 + 数据检查 + 生产构建 |
| `npm test` | 单元测试（Vitest） |
| `npm run validate-data` | 发布前数据检查（真实参数未核验却有数值会报错） |
| `npm run build-fixtures` | 由 `scripts/fixtures/demo-source.ts` 重新生成演示数据 |
| `npm run export-prompts` | 把提示词导出到 `prompts/*.md` |
| `npm run label-reviews` | 本地批量标注评论，输出草稿供人工检查 |
| `npm run eval-labels` | 计算分析质量的 precision / recall / F1 |

## 真实数据、用户数据与演示夹具

| 类型 | `data_kind` | 界面标识 | 现在有什么 |
| --- | --- | --- | --- |
| 已核验真实数据 | `real` | 来源链接 + 核验日期 | 只有 3 款候选机型的型号登记；参数全部“尚未核验” |
| 用户提交 | `user` | “用户提供，来源未独立核验” | 导入页当次处理，不保存 |
| 演示夹具 | `demo` | 黄色“演示数据”标签 | 5 款虚构机型（Alpha、Beta、Gamma、Delta、Epsilon Pro），参数、价格、84 条评论均为开发者编写 |

演示机型用来覆盖各种状态：Alpha/Beta 数据完整；Gamma 只有参数；Delta 只有少量旧评论、系统版本大多未知；Epsilon Pro 只有 512GB、价格为建议零售价。演示评论里刻意放了重复、近似重复、广告、机型混入、仅物流、语义模糊和一条“忽略之前的指令”的文本，用来检验清洗和注入防护。

## 环境变量

复制 `.env.example` 为 `.env.local`。所有变量只在服务端读取，**不要加 `NEXT_PUBLIC_` 前缀**。

| 变量 | 说明 |
| --- | --- |
| `AI_ENABLED` | 总开关，默认 `false`。设为 `false` 立即关闭所有付费调用 |
| `AI_PROVIDER` | `anthropic`（默认，官方 SDK）或 `openai_compatible`；`fixture` 仅本地开发可用 |
| `AI_API_KEY` / `AI_MODEL` / `AI_BASE_URL` | 密钥、模型名、服务地址，只由服务端配置 |
| `AI_TIMEOUT_MS` / `AI_MAX_OUTPUT_TOKENS` | 单次超时与输出上限 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 共享限流、日配额和缓存。**未配置时不发出付费请求** |
| `AI_DAILY_QUOTA` / `AI_RATE_LIMIT_PER_IP` | 全站日调用上限（含重试）、单 IP 十分钟请求数 |
| `AI_ALLOW_LOCAL_WITHOUT_QUOTA` | 仅 `NODE_ENV=development` 时有效，用进程内计数调试，部署环境无效 |
| `AI_FIXTURE_MODE` | 夹具模式下模拟 `ok` / `timeout` / `error` / `bad_citation`，用于检查回退界面 |

本地体验 AI 相关界面状态而不花钱：

```bash
AI_ENABLED=true AI_PROVIDER=fixture AI_FIXTURE_MODE=bad_citation npm run dev
```

界面会标注“测试夹具输出（非模型生成）”。

## 结构

```
data/v1/            版本化 JSON：meta、sources、phones、specs、prices、reviews、analysis、audit
data/templates/     参数、价格、来源、评论 CSV 模板
prompts/            提示词（由源码导出，供审阅）
scripts/            演示数据生成、数据检查、批量标注、质量评估
src/lib/data        数据访问（换数据源只改这里）
src/lib/clean       清洗：格式统一、完全重复、近似重复、广告、无内容、机型混入；标签校验
src/lib/stats       统计：N、各维度计数、九十天窗口、样本可比性
src/lib/rules       公平比较：存储、价格口径、价差、预算
src/lib/evidence    证据登记：参数、价格、统计、评论
src/lib/recommend   基础模式推荐引擎、AI 解释的材料组装与校验、服务编排
src/lib/ai          配置、模型适配层、限流与配额、提示词
src/lib/csv         CSV / 粘贴解析，行号定位，长度限制
src/components      界面组件（证据抽屉、机型选择、偏好标签、结果各区块）
tests/              Vitest 测试
docs/               数据缺口、评估模板、试用模板、运行记录模板、演示脚本
```

## 推荐怎样产生

1. 程序整理每个偏好的“判断”：轻便看已记录重量（差 ≥15 g 为较明确，8–15 g 为略占优）；续航、影像、游戏、系统稳定性只看**可比样本**的评论正负计数；芯片、RAM、像素、电池容量只作为事实展示。
2. 首要偏好证据不足 → “证据不足”；首要与其次方向相反 → “各有取舍”并给出倾向；被推荐的一款超预算而另一款在预算内 → 降级为“各有取舍”。
3. 每条判断带证据编号，可在抽屉里核对原始参数、价格、统计与评论原文。
4. 配置模型后，模型只能把材料改写成解释：状态不得比基础模式更激进或翻转方向；引用编号必须存在；文字中的“数字＋单位”必须原样出现在材料中。不合格的句子直接删除；整体不可用时重试一次，仍不合格就保留基础模式结果。
5. 给模型的材料不包含评论原文，评论中的指令和链接不会被执行或访问。

缓存键包含机型、存储、价格版本、数据与标签版本、样本筛选、偏好（含顺序）、预算、设备、提示词版本和模型名。缓存命中时显示原生成时间。用户上传内容不进入缓存。

## 交互与动效规范

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--dur-press` | 140ms | hover、按压 |
| `--dur-switch` | 210ms | 标签选择、内容切换、下拉框 |
| `--dur-enter` / `--dur-drawer` | 290ms / 280ms | 内容进入、证据抽屉 |
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | 统一曲线 |

- 只对 `opacity` 和 `transform` 做动画（“只看差异”收起与偏好面板展开用 `grid-template-rows`）。动画不阻塞点击、输入或滚动。
- 首页标题、副标题、表单依次上移 8px 淡入，间隔 60ms，总时长约 410ms；同一会话返回首页时跳过入场动画，并恢复已填写内容。
- 加载阶段只显示真实步骤（“正在整理对比资料”“正在生成个性化解释”），不显示进度百分比；骨架屏尺寸与最终布局对应。
- 修改偏好时保留阅读位置和已有内容，相关区块显示“更新中”；新结果返回后才替换；失败时保留原结果并标明“尚未更新”。旧的 AI 解释在偏好变化时立即作废。
- 证据抽屉：桌面右侧滑入、手机近全屏；Esc、关闭按钮、点击遮罩均可关闭；打开时焦点移入并限制在面板内，背景设为 `inert`；关闭后焦点回到触发按钮，滚动位置不变。
- `prefers-reduced-motion: reduce` 下取消滑动、缩放、骨架闪动和错峰，状态颜色与文字即时变化。
- 状态不只靠颜色：情绪用 ＋ － ± ○ 符号，推荐状态带箭头和文字，缺失值用虚线框和“尚未核验”文字。

## 部署到 Vercel

本目录位于仓库子目录 `phonelens/`。

1. 在 Vercel 新建项目，导入本仓库，**Root Directory 设为 `phonelens`**，框架选 Next.js，构建命令 `npm run build`，安装命令 `npm ci`。
2. 只想公开演示基础模式：不设置任何 AI 变量即可（`AI_ENABLED` 默认关闭）。
3. 需要公开启用模型调用时，必须同时配置：`AI_ENABLED=true`、`AI_API_KEY`、`AI_MODEL`、`UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`、`AI_DAILY_QUOTA`。缺少共享存储时服务端会拒绝付费调用。
4. 可在 Vercel 防火墙为 `/api/recommend` 与 `/api/import` 加一层限流规则作为补充；实际额度、价格与可用条件以上线时的官方文档为准。
5. 部署后检查：首页、示例对比、证据抽屉、导入页；`/api/status` 只返回是否可用和原因，不暴露配置。

以上部署步骤**尚未执行**，需要你的 Vercel 与 Upstash 账号。

## 已验证与未验证

已在本地验证（2026-11-20）：

- `npm run typecheck`、`npm test`（全部通过）、`npm run validate-data`、`npm run build`。
- Playwright 走查：桌面与 iPhone 13 视口的首页 → 结果页 → 证据抽屉 → 修改偏好 → 切换样本范围 → 返回首页恢复表单；键盘完成机型选择、偏好、提交、抽屉开关与焦点返回；减少动态效果模式；手机端无横向滚动；夹具模式下 AI 生成、非法引用删除、超时回退、偏好变化后缓存失效与缓存命中显示原生成时间。

未完成（需要人工、账号或外部条件）：

- 真实机型参数、价格、评论的核验与录入；评论来源授权确认。
- 真实模型调用与费用、限流在线上环境的实际效果。
- 分析质量评估（[`docs/evaluation-template.md`](docs/evaluation-template.md)）、用户访谈与试用（[`docs/user-trial-template.md`](docs/user-trial-template.md)）、运行记录（[`docs/run-log-template.md`](docs/run-log-template.md)）。这些文档目前只有模板，没有结果。
