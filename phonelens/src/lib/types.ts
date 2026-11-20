/**
 * PhoneLens 核心数据类型。
 * data_kind 严格区分：real（已核验真实数据）、user（用户提交，未独立核验）、demo（开发演示夹具）。
 */

export type DataKind = "real" | "user" | "demo";

export type VerifyStatus =
  | "human_verified" // 人工对照官网核验
  | "unverified" // 尚未核验
  | "fixture"; // 演示夹具，非真实数据

export interface SourceRecord {
  id: string;
  kind: "official_spec" | "official_price" | "review_source" | "demo_fixture" | "user_import";
  name: string;
  url: string | null;
  access_method: string;
  allowed_storage: string;
  allowed_display: "full_text" | "excerpt" | "summary_only" | "none";
  collected_at: string | null;
  verification: VerifyStatus;
  notes: string;
}

export type SaleStatus = "on_sale" | "out_of_stock" | "discontinued" | "unverified" | "demo";

export interface PhoneRecord {
  id: string;
  brand: string;
  model: string;
  aliases: string[];
  region: string;
  storage: string;
  ram: string | null;
  sale_status: SaleStatus;
  verified_at: string | null;
  data_kind: DataKind;
  note: string;
}

export type SpecField =
  | "chip"
  | "ram_gb"
  | "weight_g"
  | "height_mm"
  | "width_mm"
  | "thickness_mm"
  | "display_size_in"
  | "display_refresh_hz"
  | "battery_mah"
  | "wired_charging_w"
  | "wireless_charging_w"
  | "rear_camera_count"
  | "main_camera_mp"
  | "telephoto"
  | "front_camera_mp"
  | "os"
  | "ip_rating";

export interface SpecRecord {
  id: string; // spec:<phone>:<field>
  phone_id: string;
  field: SpecField;
  value: string | number | null;
  unit: string | null;
  source_id: string | null;
  verified_at: string | null;
  missing_reason: null | "官网未列出" | "尚未核验";
  data_kind: DataKind;
  note?: string;
}

export type PriceType = "official_current" | "official_msrp" | "user_reported";

export interface PriceRecord {
  id: string;
  phone_id: string;
  storage: string;
  amount: number;
  currency: "CNY";
  price_type: PriceType;
  channel: string;
  conditions: string | null;
  recorded_at: string;
  source_id: string | null;
  data_kind: DataKind;
}

export interface ReviewRecord {
  id: string;
  phone_id: string;
  text: string;
  source_id: string;
  review_date: string | null;
  collected_at: string;
  system_version: string | null;
  usage_scope: string;
  data_kind: DataKind;
}

export const DIMENSIONS = ["battery", "heat", "camera", "smoothness", "stability", "handling"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
/** 购物体验单独归类，不计入手机性能口碑 */
export type LabelDimension = Dimension | "shopping";
export const LABEL_DIMENSIONS: readonly LabelDimension[] = [...DIMENSIONS, "shopping"];

export const SENTIMENTS = ["pos", "neg", "neu", "mixed"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export interface ReviewLabel {
  review_id: string;
  dimension: LabelDimension;
  sentiment: Sentiment;
  excerpt: string;
  explanation: string;
}

export interface AnalysisRecord {
  review_id: string;
  status: "analyzed" | "needs_review" | "pending";
  labels: ReviewLabel[];
  labeler: string; // manual_demo | model:<name>
  prompt_version: string | null;
  reviewed_by: string | null;
}

export type ExclusionReason =
  | "duplicate"
  | "near_duplicate"
  | "model_mismatch"
  | "ad"
  | "no_usage_content"
  | "shopping_only";

export interface AuditRecord {
  review_id: string;
  decision: "exclude" | "keep";
  reason: ExclusionReason | null;
  note: string;
  reviewed_at: string;
}

export interface DataMeta {
  data_version: string;
  label_version: string;
  price_version: string;
  as_of: string; // 数据整理基准日期，九十天窗口以此计算
  notes: string;
}

export type Preference = "camera" | "gaming" | "battery" | "handling" | "ecosystem";
export const PREFERENCES: readonly Preference[] = ["camera", "gaming", "battery", "handling", "ecosystem"];

export type CurrentDevice = "iphone" | "android" | null;
export type EcoDevice = "ipad" | "mac" | "apple_watch" | "android_tablet" | "windows_pc" | "android_watch";

export interface UserNeeds {
  budget: number | null;
  prefs: Preference[]; // 有序，最多两项，第一项为首要
  device: CurrentDevice;
  eco: EcoDevice[];
}

export type SampleWindow = "90d" | "all";

export type RecStatus = "prefer_a" | "prefer_b" | "tradeoff" | "insufficient";
