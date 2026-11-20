import "server-only";

/**
 * 服务端模型配置。所有值来自环境变量，绝不使用 NEXT_PUBLIC_ 前缀。
 */
export type ProviderKind = "anthropic" | "openai_compatible" | "fixture";

export interface AiConfig {
  enabled: boolean;
  provider: ProviderKind;
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  timeoutMs: number;
  maxOutputTokens: number;
  dailyQuota: number;
  ratePerIp: number;
  redisUrl: string | null;
  redisToken: string | null;
  allowLocalWithoutQuota: boolean;
  isDev: boolean;
}

function int(v: string | undefined, d: number, min: number, max: number) {
  const n = Number.parseInt(v ?? "", 10);
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
}

export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  const provider = (env.AI_PROVIDER ?? "anthropic") as ProviderKind;
  const isDev = env.NODE_ENV !== "production";
  return {
    enabled: env.AI_ENABLED === "true",
    provider: ["anthropic", "openai_compatible", "fixture"].includes(provider) ? provider : "anthropic",
    apiKey: env.AI_API_KEY?.trim() || null,
    baseUrl: env.AI_BASE_URL?.trim() || null,
    model: env.AI_MODEL?.trim() || null,
    timeoutMs: int(env.AI_TIMEOUT_MS, 20000, 2000, 60000),
    maxOutputTokens: int(env.AI_MAX_OUTPUT_TOKENS, 900, 200, 4000),
    dailyQuota: int(env.AI_DAILY_QUOTA, 200, 0, 100000),
    ratePerIp: int(env.AI_RATE_LIMIT_PER_IP, 8, 1, 1000),
    redisUrl: env.UPSTASH_REDIS_REST_URL?.trim() || null,
    redisToken: env.UPSTASH_REDIS_REST_TOKEN?.trim() || null,
    allowLocalWithoutQuota: isDev && env.AI_ALLOW_LOCAL_WITHOUT_QUOTA === "true",
    isDev,
  };
}

export type Unavailable =
  | "disabled" // 关闭开关
  | "no_key"
  | "no_model"
  | "no_quota_store" // 公开环境没有共享配额存储，默认关闭付费调用
  | "fixture_in_production";

/** 是否允许发出付费调用（不含配额是否还有余量） */
export function aiUnavailableReason(c: AiConfig): Unavailable | null {
  if (!c.enabled) return "disabled";
  if (c.provider === "fixture") return c.isDev ? null : "fixture_in_production";
  if (!c.apiKey) return "no_key";
  if (!c.model) return "no_model";
  if (!(c.redisUrl && c.redisToken) && !c.allowLocalWithoutQuota) return "no_quota_store";
  return null;
}

export const UNAVAILABLE_TEXT: Record<Unavailable | "quota_exhausted" | "rate_limited" | "quota_store_error", string> = {
  disabled: "个性化解释服务当前关闭，以下为基础模式结果。",
  no_key: "尚未配置模型服务，以下为基础模式结果。",
  no_model: "尚未配置模型名称，以下为基础模式结果。",
  no_quota_store: "未配置共享调用配额，为避免失控费用，公开调用保持关闭，以下为基础模式结果。",
  fixture_in_production: "测试夹具只能在本地开发环境使用。",
  quota_exhausted: "今日个性化解释额度已用完，以下为基础模式结果，明天可再试。",
  rate_limited: "请求过于频繁，请稍后再试。基础比较不受影响。",
  quota_store_error: "调用配额服务暂时不可用，已关闭个性化解释，基础比较不受影响。",
};
