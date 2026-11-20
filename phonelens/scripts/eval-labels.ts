/**
 * 分析质量评估：比较人工金标准与模型标注，按维度输出 precision / recall / F1、摘录匹配率。
 * 输入：两个 JSON 文件，格式均为 [{review_id, dimension, sentiment, excerpt}]
 * 用法：npx tsx scripts/eval-labels.ts gold.json pred.json reviews.json
 * 一个“命中”= 同一评论、同一维度、同一情绪。评估集需与提示词调试样本分开。
 */
import { readFileSync } from "node:fs";

type L = { review_id: string; dimension: string; sentiment: string; excerpt?: string };
const [goldPath, predPath, reviewsPath] = process.argv.slice(2);
if (!goldPath || !predPath) {
  console.error("用法：npx tsx scripts/eval-labels.ts gold.json pred.json [reviews.json]");
  process.exit(1);
}
const gold: L[] = JSON.parse(readFileSync(goldPath, "utf8"));
const pred: L[] = JSON.parse(readFileSync(predPath, "utf8"));
const texts: Map<string, string> = reviewsPath ? new Map((JSON.parse(readFileSync(reviewsPath, "utf8")) as { id: string; text: string }[]).map((r) => [r.id, r.text])) : new Map();

const key = (l: L) => `${l.review_id}|${l.dimension}|${l.sentiment}`;
const dims = [...new Set([...gold, ...pred].map((l) => l.dimension))].sort();
const rows: string[] = ["维度\tgold\tpred\tTP\tprecision\trecall\tF1"];
let TP = 0;
for (const d of dims) {
  const g = new Set(gold.filter((l) => l.dimension === d).map(key));
  const p = new Set(pred.filter((l) => l.dimension === d).map(key));
  const tp = [...p].filter((k) => g.has(k)).length;
  TP += tp;
  const pr = p.size ? tp / p.size : 0;
  const rc = g.size ? tp / g.size : 0;
  const f1 = pr + rc ? (2 * pr * rc) / (pr + rc) : 0;
  rows.push(`${d}\t${g.size}\t${p.size}\t${tp}\t${pr.toFixed(3)}\t${rc.toFixed(3)}\t${f1.toFixed(3)}`);
}
console.log(rows.join("\n"));
console.log(`\n总计 gold=${gold.length} pred=${pred.length} TP=${TP}`);
if (texts.size) {
  const ok = pred.filter((l) => l.excerpt && texts.get(l.review_id)?.includes(l.excerpt)).length;
  console.log(`摘录逐字匹配：${ok}/${pred.length}`);
  console.log(`非法引用（评论编号不存在）：${pred.filter((l) => !texts.has(l.review_id)).length}`);
}
