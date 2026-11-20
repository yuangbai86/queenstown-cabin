/**
 * 生成 data/v1 下的版本化 JSON。
 * - 真实候选机型：只登记型号与来源入口，参数全部为“尚未核验”，不填任何数值。
 * - 演示机型：虚构品牌与参数，data_kind = "demo"，界面会醒目标注。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALPHA, BETA, DELTA, type CompactReview } from "./fixtures/demo-source";
import type {
  AnalysisRecord,
  AuditRecord,
  DataMeta,
  LabelDimension,
  PhoneRecord,
  PriceRecord,
  ReviewLabel,
  ReviewRecord,
  Sentiment,
  SourceRecord,
  SpecField,
  SpecRecord,
} from "../src/lib/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../data/v1");
mkdirSync(OUT, { recursive: true });

const AS_OF = "2026-11-20";

const meta: DataMeta = {
  data_version: "v1-2026-11-20.3",
  label_version: "labels-demo-2026-11-20.2",
  price_version: "prices-2026-11-20.1",
  as_of: AS_OF,
  notes:
    "本版本只包含演示夹具与待核验的真实候选机型。官网在当前开发环境无法访问，真实机型参数、价格和评论均未录入。",
};

const sources: SourceRecord[] = [
  {
    id: "src-demo-spec",
    kind: "demo_fixture",
    name: "演示参数夹具（开发者编写）",
    url: null,
    access_method: "开发者手工编写，用于验证界面与规则",
    allowed_storage: "可保存于公开仓库",
    allowed_display: "full_text",
    collected_at: AS_OF,
    verification: "fixture",
    notes: "虚构机型的虚构参数，不对应任何真实产品。",
  },
  {
    id: "src-demo-price",
    kind: "demo_fixture",
    name: "演示价格夹具（开发者编写）",
    url: null,
    access_method: "开发者手工编写",
    allowed_storage: "可保存于公开仓库",
    allowed_display: "full_text",
    collected_at: AS_OF,
    verification: "fixture",
    notes: "虚构价格，仅用于验证价格口径规则。",
  },
  {
    id: "src-demo-reviews",
    kind: "demo_fixture",
    name: "演示评论夹具（开发者编写，非真实用户评论）",
    url: null,
    access_method: "开发者手工编写，覆盖多维度、褒贬混合、重复、机型混入、广告等测试情形",
    allowed_storage: "可保存于公开仓库",
    allowed_display: "full_text",
    collected_at: AS_OF,
    verification: "fixture",
    notes: "不是采集结果，不代表任何真实机型的口碑。",
  },
  {
    id: "src-apple-cn-compare",
    kind: "official_spec",
    name: "Apple 中国大陆官网 机型比较",
    url: "https://www.apple.com.cn/iphone/compare/",
    access_method: "人工核验（待进行）",
    allowed_storage: "仅保存结构化参数与来源链接",
    allowed_display: "summary_only",
    collected_at: null,
    verification: "unverified",
    notes: "2026-11-20 开发环境无法访问该域名，尚未核验任何字段。",
  },
  {
    id: "src-mi-17-specs",
    kind: "official_spec",
    name: "小米官网 小米 17 参数页",
    url: "https://www.mi.com/prod/xiaomi-17/specs",
    access_method: "人工核验（待进行）",
    allowed_storage: "仅保存结构化参数与来源链接",
    allowed_display: "summary_only",
    collected_at: null,
    verification: "unverified",
    notes: "2026-11-20 开发环境无法访问该域名，尚未核验任何字段。",
  },
  {
    id: "src-vivo-x200-param",
    kind: "official_spec",
    name: "vivo 官网 X200 参数页",
    url: "https://www.vivo.com.cn/vivo/param/x200",
    access_method: "人工核验（待进行）",
    allowed_storage: "仅保存结构化参数与来源链接",
    allowed_display: "summary_only",
    collected_at: null,
    verification: "unverified",
    notes: "规划稿记录该页曾显示缺货；参数页存在不能证明在售。2026-11-20 开发环境无法访问。",
  },
];

const phones: PhoneRecord[] = [
  {
    id: "demo-alpha",
    brand: "演示品牌甲",
    model: "Alpha",
    aliases: ["alpha", "阿尔法", "甲 alpha"],
    region: "中国大陆版（演示）",
    storage: "256GB",
    ram: "8GB",
    sale_status: "demo",
    verified_at: null,
    data_kind: "demo",
    note: "虚构机型：轻薄小屏、带长焦。参数与评论均为演示夹具。",
  },
  {
    id: "demo-beta",
    brand: "演示品牌乙",
    model: "Beta",
    aliases: ["beta", "贝塔", "乙 beta"],
    region: "中国大陆版（演示）",
    storage: "256GB",
    ram: "12GB",
    sale_status: "demo",
    verified_at: null,
    data_kind: "demo",
    note: "虚构机型：大电池、较重。参数与评论均为演示夹具。",
  },
  {
    id: "demo-gamma",
    brand: "演示品牌丙",
    model: "Gamma",
    aliases: ["gamma", "伽马"],
    region: "中国大陆版（演示）",
    storage: "256GB",
    ram: "12GB",
    sale_status: "demo",
    verified_at: null,
    data_kind: "demo",
    note: "虚构机型：只有参数、没有评论，用于演示“仅参数”状态。",
  },
  {
    id: "demo-delta",
    brand: "演示品牌甲",
    model: "Delta",
    aliases: ["delta", "德尔塔"],
    region: "中国大陆版（演示）",
    storage: "256GB",
    ram: null,
    sale_status: "demo",
    verified_at: null,
    data_kind: "demo",
    note: "虚构机型：只有少量旧评论、参数未核验，用于演示“仅评论”和旧样本状态。",
  },
  {
    id: "demo-epsilon",
    brand: "演示品牌乙",
    model: "Epsilon Pro",
    aliases: ["epsilon", "艾普西隆"],
    region: "中国大陆版（演示）",
    storage: "512GB",
    ram: "16GB",
    sale_status: "demo",
    verified_at: null,
    data_kind: "demo",
    note: "虚构机型：只有 512GB 版本、价格为建议零售价，用于演示存储与价格口径提示。",
  },
  {
    id: "apple-iphone-17-256",
    brand: "Apple",
    model: "iPhone 17",
    aliases: ["iphone17", "iphone 17", "苹果17"],
    region: "中国大陆版",
    storage: "256GB",
    ram: null,
    sale_status: "unverified",
    verified_at: null,
    data_kind: "real",
    note: "候选机型，型号、在售状态与全部参数待人工核验。",
  },
  {
    id: "xiaomi-17-256",
    brand: "小米",
    model: "17",
    aliases: ["xiaomi 17", "mi 17", "小米17"],
    region: "中国大陆版",
    storage: "256GB",
    ram: null,
    sale_status: "unverified",
    verified_at: null,
    data_kind: "real",
    note: "候选机型，在售状态、存储版本与全部参数待人工核验。",
  },
  {
    id: "vivo-x200-256",
    brand: "vivo",
    model: "X200",
    aliases: ["vivo x200", "x200"],
    region: "中国大陆版",
    storage: "256GB",
    ram: null,
    sale_status: "unverified",
    verified_at: null,
    data_kind: "real",
    note: "候选机型；规划稿记录官网曾显示缺货，在售状态待核验。",
  },
];

type SpecInput = Partial<Record<SpecField, string | number | null>>;
const UNITS: Partial<Record<SpecField, string>> = {
  ram_gb: "GB",
  weight_g: "g",
  height_mm: "mm",
  width_mm: "mm",
  thickness_mm: "mm",
  display_size_in: "英寸",
  display_refresh_hz: "Hz",
  battery_mah: "mAh",
  wired_charging_w: "W",
  wireless_charging_w: "W",
  rear_camera_count: "颗",
  main_camera_mp: "MP",
  front_camera_mp: "MP",
};
const ALL_FIELDS: SpecField[] = [
  "chip", "ram_gb", "os", "weight_g", "height_mm", "width_mm", "thickness_mm", "ip_rating",
  "display_size_in", "display_refresh_hz", "battery_mah", "wired_charging_w", "wireless_charging_w",
  "rear_camera_count", "main_camera_mp", "telephoto", "front_camera_mp",
];

function specs(phoneId: string, input: SpecInput, kind: "demo" | "real", sourceId: string, missing: Partial<Record<SpecField, "官网未列出" | "尚未核验">> = {}): SpecRecord[] {
  return ALL_FIELDS.map((field) => {
    const has = Object.prototype.hasOwnProperty.call(input, field) && input[field] !== null && input[field] !== undefined;
    return {
      id: `spec:${phoneId}:${field}`,
      phone_id: phoneId,
      field,
      value: has ? (input[field] as string | number) : null,
      unit: UNITS[field] ?? null,
      source_id: sourceId,
      verified_at: has && kind === "demo" ? AS_OF : null,
      missing_reason: has ? null : missing[field] ?? "尚未核验",
      data_kind: kind,
    };
  });
}

const specRecords: SpecRecord[] = [
  ...specs("demo-alpha", {
    chip: "演示芯片 X1", ram_gb: 8, os: "演示OS 6", weight_g: 178, height_mm: 147.6, width_mm: 71.5, thickness_mm: 7.9,
    ip_rating: "IP68", display_size_in: 6.1, display_refresh_hz: 120, battery_mah: 3800, wired_charging_w: 30,
    wireless_charging_w: 15, rear_camera_count: 3, main_camera_mp: 48, telephoto: "5 倍潜望式长焦", front_camera_mp: 12,
  }, "demo", "src-demo-spec"),
  ...specs("demo-beta", {
    chip: "演示芯片 Z9", ram_gb: 12, os: "演示UI 4", weight_g: 214, height_mm: 163.2, width_mm: 76.8, thickness_mm: 8.9,
    ip_rating: "IP68", display_size_in: 6.78, display_refresh_hz: 120, battery_mah: 6100, wired_charging_w: 90,
    rear_camera_count: 2, main_camera_mp: 50, telephoto: "无", front_camera_mp: 32,
  }, "demo", "src-demo-spec", { wireless_charging_w: "官网未列出" }),
  ...specs("demo-gamma", {
    chip: "演示芯片 M5", ram_gb: 12, os: "演示UX 2", weight_g: 196, height_mm: 158.0, width_mm: 74.2, thickness_mm: 8.2,
    display_size_in: 6.55, display_refresh_hz: 144, battery_mah: 5200, wired_charging_w: 67, rear_camera_count: 3,
    main_camera_mp: 50, telephoto: "3 倍长焦", front_camera_mp: 20,
  }, "demo", "src-demo-spec", { ip_rating: "官网未列出", wireless_charging_w: "官网未列出" }),
  ...specs("demo-delta", {}, "demo", "src-demo-spec"),
  ...specs("demo-epsilon", {
    chip: "演示芯片 Z9 Pro", ram_gb: 16, os: "演示UI 4", weight_g: 226, height_mm: 162.5, width_mm: 76.2, thickness_mm: 8.8,
    ip_rating: "IP69", display_size_in: 6.82, display_refresh_hz: 120, battery_mah: 6000, wired_charging_w: 120,
    wireless_charging_w: 80, rear_camera_count: 3, main_camera_mp: 50, telephoto: "3.7 倍潜望式长焦", front_camera_mp: 50,
  }, "demo", "src-demo-spec"),
  ...specs("apple-iphone-17-256", {}, "real", "src-apple-cn-compare"),
  ...specs("xiaomi-17-256", {}, "real", "src-mi-17-specs"),
  ...specs("vivo-x200-256", {}, "real", "src-vivo-x200-param"),
];

const prices: PriceRecord[] = [
  { id: "price:demo-alpha:256", phone_id: "demo-alpha", storage: "256GB", amount: 5999, currency: "CNY", price_type: "official_current", channel: "演示官网", conditions: "不含以旧换新与平台补贴", recorded_at: "2026-11-18", source_id: "src-demo-price", data_kind: "demo" },
  { id: "price:demo-beta:256", phone_id: "demo-beta", storage: "256GB", amount: 4799, currency: "CNY", price_type: "official_current", channel: "演示官网", conditions: "不含以旧换新与平台补贴", recorded_at: "2026-11-18", source_id: "src-demo-price", data_kind: "demo" },
  { id: "price:demo-gamma:256", phone_id: "demo-gamma", storage: "256GB", amount: 3299, currency: "CNY", price_type: "official_msrp", channel: "演示官网（发布会建议零售价）", conditions: null, recorded_at: "2026-09-01", source_id: "src-demo-price", data_kind: "demo" },
  { id: "price:demo-epsilon:512", phone_id: "demo-epsilon", storage: "512GB", amount: 8999, currency: "CNY", price_type: "official_msrp", channel: "演示官网（建议零售价）", conditions: "未核验当前售价", recorded_at: "2026-10-15", source_id: "src-demo-price", data_kind: "demo" },
];

const SYM: Record<string, Sentiment> = { "+": "pos", "-": "neg", "=": "neu", "~": "mixed" };

const reviews: ReviewRecord[] = [];
const analysis: AnalysisRecord[] = [];
const audit: AuditRecord[] = [];

function addReviews(prefix: string, phoneId: string, list: CompactReview[]) {
  list.forEach((r, i) => {
    const id = `${prefix}-${String(i + 1).padStart(3, "0")}`;
    reviews.push({
      id,
      phone_id: phoneId,
      text: r.t,
      source_id: "src-demo-reviews",
      review_date: r.d,
      collected_at: AS_OF,
      system_version: r.v,
      usage_scope: "演示夹具，可公开展示全文",
      data_kind: "demo",
    });
    if (r.audit) {
      audit.push({ review_id: id, decision: r.audit.decision, reason: r.audit.reason as AuditRecord["reason"], note: r.audit.note, reviewed_at: AS_OF });
    }
    if (r.status === "pending") {
      analysis.push({ review_id: id, status: "pending", labels: [], labeler: "none", prompt_version: null, reviewed_by: null });
      return;
    }
    if (r.status === "needs_review") {
      analysis.push({ review_id: id, status: "needs_review", labels: [], labeler: "manual_demo", prompt_version: null, reviewed_by: null });
      return;
    }
    if (r.audit) return; // 已排除的样本不做维度标注
    const labels: ReviewLabel[] = (r.l ?? "").split("|").filter(Boolean).map((part) => {
      const m = /^([a-z]+)([+\-=~]):(.+)$/.exec(part);
      if (!m) throw new Error(`标注格式错误：${id} ${part}`);
      const [, dim, s, excerpt] = m;
      if (!r.t.includes(excerpt)) throw new Error(`摘录不在原文中：${id} ${excerpt}`);
      return { review_id: id, dimension: dim as LabelDimension, sentiment: SYM[s], excerpt, explanation: "人工演示标注" };
    });
    analysis.push({ review_id: id, status: "analyzed", labels, labeler: "manual_demo", prompt_version: null, reviewed_by: "开发者（演示）" });
  });
}

addReviews("demo-a", "demo-alpha", ALPHA);
addReviews("demo-b", "demo-beta", BETA);
addReviews("demo-d", "demo-delta", DELTA);

const write = (name: string, data: unknown) => writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + "\n");
write("meta.json", meta);
write("sources.json", sources);
write("phones.json", phones);
write("specs.json", specRecords);
write("prices.json", prices);
write("reviews.json", reviews);
write("analysis.json", analysis);
write("audit.json", audit);
console.log(`已生成 ${phones.length} 款机型、${specRecords.length} 条参数记录、${prices.length} 条价格、${reviews.length} 条评论（全部为演示夹具）。`);
