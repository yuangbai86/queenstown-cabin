/**
 * 数据发布前检查：结构、引用完整性、标签摘录、真实数据不得含未核验数值。
 * 用法：npm run validate-data
 */
import { dataset } from "../src/lib/data";
import { revalidateAnalysis } from "../src/lib/clean";

const problems: string[] = [];
const ids = new Set<string>();
const phoneIds = new Set(dataset.phones.map((p) => p.id));
const sourceIds = new Set(dataset.sources.map((s) => s.id));

for (const p of dataset.phones) {
  if (ids.has(p.id)) problems.push(`重复机型编号 ${p.id}`);
  ids.add(p.id);
  if (p.data_kind === "real" && p.sale_status === "on_sale" && !p.verified_at) problems.push(`${p.id} 标为在售但没有核验日期`);
}
for (const s of dataset.specs) {
  if (!phoneIds.has(s.phone_id)) problems.push(`参数 ${s.id} 指向不存在的机型`);
  if (s.source_id && !sourceIds.has(s.source_id)) problems.push(`参数 ${s.id} 来源未登记`);
  if (s.value === null && !s.missing_reason) problems.push(`参数 ${s.id} 为空但没有缺失原因`);
  if (s.value !== null && s.data_kind === "real") {
    const src = dataset.sources.find((x) => x.id === s.source_id);
    if (!s.verified_at || src?.verification !== "human_verified") problems.push(`真实参数 ${s.id} 有数值，但来源未人工核验`);
  }
}
for (const p of dataset.prices) {
  if (!phoneIds.has(p.phone_id)) problems.push(`价格 ${p.id} 指向不存在的机型`);
  if (p.currency !== "CNY") problems.push(`价格 ${p.id} 币种不是人民币`);
  if (p.data_kind === "real" && p.price_type === "official_current" && !p.source_id) problems.push(`价格 ${p.id} 标为官方当前售价但没有来源`);
}
const reviewIds = new Set<string>();
for (const r of dataset.reviews) {
  if (reviewIds.has(r.id)) problems.push(`重复评论编号 ${r.id}`);
  reviewIds.add(r.id);
  if (!sourceIds.has(r.source_id)) problems.push(`评论 ${r.id} 来源未登记`);
  const src = dataset.sources.find((x) => x.id === r.source_id);
  if (r.data_kind === "real" && (!src || src.allowed_display === "none")) problems.push(`评论 ${r.id} 没有允许展示的依据，不能放入公开数据`);
}
for (const a of dataset.analysis) if (!reviewIds.has(a.review_id)) problems.push(`分析记录指向不存在的评论 ${a.review_id}`);
const { issues } = revalidateAnalysis(dataset.analysis, dataset.reviews);
for (const i of issues) problems.push(`标签问题 ${i.review_id}：${i.detail}`);

console.log(`机型 ${dataset.phones.length}，参数 ${dataset.specs.length}，价格 ${dataset.prices.length}，评论 ${dataset.reviews.length}，分析 ${dataset.analysis.length}`);
if (problems.length) {
  console.error(`发现 ${problems.length} 个问题：\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("数据检查通过。");
