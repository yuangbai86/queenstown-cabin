import type { Dimension, LabelDimension, Preference, Sentiment, SpecField, PriceType, ExclusionReason, EcoDevice, SaleStatus } from "./types";

export const DIMENSION_LABEL: Record<LabelDimension, string> = {
  battery: "续航",
  heat: "发热",
  camera: "影像",
  smoothness: "流畅度",
  stability: "系统稳定性",
  handling: "手感",
  shopping: "购物体验",
};

export const DIMENSION_SCOPE: Record<Dimension, { allowed: string; not: string }> = {
  battery: { allowed: "使用时长感受、掉电情境、充电体验", not: "电池容量大就一定更耐用" },
  heat: { allowed: "发热场景、严重程度的主观表述", not: "提及率等于故障概率" },
  camera: { allowed: "视频、夜景、人像等具体反馈", not: "像素高就一定拍得更好" },
  smoothness: { allowed: "应用切换、游戏卡顿、掉帧反馈", not: "跨系统 RAM 数量直接决定流畅度" },
  stability: { allowed: "闪退、更新、通知、兼容性", not: "旧系统的问题必然持续存在" },
  handling: { allowed: "重量、尺寸、单手握持体验", not: "所有人都会有相同手感" },
};

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  pos: "正面",
  neg: "负面",
  neu: "中性",
  mixed: "褒贬混合",
};

/** 非颜色的符号，保证状态不只靠颜色区分 */
export const SENTIMENT_SYMBOL: Record<Sentiment, string> = {
  pos: "＋",
  neg: "－",
  neu: "○",
  mixed: "±",
};

export const PREFERENCE_LABEL: Record<Preference, string> = {
  camera: "拍照与视频",
  gaming: "游戏",
  battery: "续航",
  handling: "轻便手感",
  ecosystem: "系统与生态",
};

export const ECO_LABEL: Record<EcoDevice, string> = {
  ipad: "iPad",
  mac: "Mac",
  apple_watch: "Apple Watch",
  android_tablet: "安卓平板",
  windows_pc: "Windows 电脑",
  android_watch: "安卓手表 / 手环",
};

export const PRICE_TYPE_LABEL: Record<PriceType, string> = {
  official_current: "官方当前售价",
  official_msrp: "官方建议零售价",
  user_reported: "用户填写，未核验",
};

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  on_sale: "官网在售",
  out_of_stock: "官网显示缺货",
  discontinued: "已停售",
  unverified: "销售状态待核验",
  demo: "演示机型（虚构）",
};

export const EXCLUSION_LABEL: Record<ExclusionReason, string> = {
  duplicate: "完全重复",
  near_duplicate: "近似重复（人工确认）",
  model_mismatch: "机型混入",
  ad: "广告或引流",
  no_usage_content: "缺少使用内容",
  shopping_only: "仅涉及物流、客服或包装",
};

export interface SpecFieldDef {
  field: SpecField;
  label: string;
  group: "基本" | "机身" | "屏幕" | "电池与充电" | "影像" | "系统";
  /** 解释该规格不能推出什么，展示在参数表中 */
  caution?: string;
  numeric: boolean;
}

export const SPEC_FIELDS: SpecFieldDef[] = [
  { field: "chip", label: "处理器", group: "基本", numeric: false, caution: "芯片名称不能直接说明实际游戏表现" },
  { field: "ram_gb", label: "运行内存", group: "基本", numeric: true, caution: "跨系统比较时，RAM 数量不能直接决定流畅度" },
  { field: "os", label: "出厂系统", group: "系统", numeric: false },
  { field: "weight_g", label: "重量", group: "机身", numeric: true, caution: "握持感还与宽度、重心和个人习惯有关" },
  { field: "height_mm", label: "高度", group: "机身", numeric: true },
  { field: "width_mm", label: "宽度", group: "机身", numeric: true },
  { field: "thickness_mm", label: "厚度", group: "机身", numeric: true },
  { field: "ip_rating", label: "防尘防水", group: "机身", numeric: false },
  { field: "display_size_in", label: "屏幕尺寸", group: "屏幕", numeric: true },
  { field: "display_refresh_hz", label: "最高刷新率", group: "屏幕", numeric: true },
  { field: "battery_mah", label: "电池容量", group: "电池与充电", numeric: true, caution: "容量大不等于实际续航更长" },
  { field: "wired_charging_w", label: "有线充电", group: "电池与充电", numeric: true },
  { field: "wireless_charging_w", label: "无线充电", group: "电池与充电", numeric: true },
  { field: "rear_camera_count", label: "后置摄像头", group: "影像", numeric: true },
  { field: "main_camera_mp", label: "主摄像素", group: "影像", numeric: true, caution: "像素高不等于成像更好" },
  { field: "telephoto", label: "长焦", group: "影像", numeric: false },
  { field: "front_camera_mp", label: "前置像素", group: "影像", numeric: true },
];

export const SPEC_FIELD_MAP = Object.fromEntries(SPEC_FIELDS.map((f) => [f.field, f])) as Record<SpecField, SpecFieldDef>;

export const REC_STATUS_LABEL = {
  prefer_a: "更值得考虑 A",
  prefer_b: "更值得考虑 B",
  tradeoff: "各有取舍",
  insufficient: "证据不足",
} as const;
