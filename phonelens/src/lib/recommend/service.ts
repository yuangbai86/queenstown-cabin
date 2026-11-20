import "server-only";
import { aiUnavailableReason, readAiConfig, UNAVAILABLE_TEXT, type AiConfig } from "../ai/config";
import { checkRate, consumeQuota, hashIp, storeFor, type CounterStore } from "../ai/guard";
import { AiError, createAdapter, type AiAdapter } from "../ai/adapter";
import { RECOMMEND_PROMPT_VERSION, RECOMMEND_SYSTEM } from "../ai/prompts";
import { cacheGet, cacheSet } from "../cache";
import type { Comparison } from "./compare";
import {
  AiRecommendationSchema,
  buildPack,
  buildUserMessage,
  cacheKey,
  fixtureExplanation,
  validateExplanation,
  type ValidatedExplanation,
} from "./ai-explain";

export type ExplainResponse =
  | {
      mode: "ai";
      fixture: boolean;
      cached: boolean;
      generated_at: string;
      explanation: Omit<ValidatedExplanation, "issues"> & { removed: number };
      versions: { prompt: string; data: string; labels: string };
    }
  | {
      mode: "baseline";
      reason: string;
      message: string;
      retryable: boolean;
    };

export interface ServiceDeps {
  config?: AiConfig;
  adapter?: AiAdapter;
  store?: CounterStore | null;
  ip?: string;
  now?: () => Date;
}

/**
 * 为一次对比生成个性化解释。任何失败都回退到基础模式结果，不影响已展示内容。
 * 每次真实调用（包括唯一一次自动重试）都会先消耗共享配额。
 */
export async function explain(c: Comparison, deps: ServiceDeps = {}): Promise<ExplainResponse> {
  const config = deps.config ?? readAiConfig();
  const unavailable = aiUnavailableReason(config);
  if (unavailable) return { mode: "baseline", reason: unavailable, message: UNAVAILABLE_TEXT[unavailable], retryable: false };

  const store = deps.store !== undefined ? deps.store : storeFor(config);
  if (!store) return { mode: "baseline", reason: "no_quota_store", message: UNAVAILABLE_TEXT.no_quota_store, retryable: false };

  const pack = buildPack(c);
  const fixture = config.provider === "fixture";
  const model = fixture ? `fixture:${process.env.AI_FIXTURE_MODE ?? "ok"}` : config.model!;
  const key = cacheKey({
    a: c.a.id,
    b: c.b.id,
    storage: [c.a.storage, c.b.storage],
    priceVersion: c.versions.prices,
    dataVersion: c.versions.data,
    labelVersion: c.versions.labels,
    window: c.window,
    prefs: c.needs.prefs,
    budget: c.needs.budget,
    device: c.needs.device,
    eco: c.needs.eco,
    promptVersion: RECOMMEND_PROMPT_VERSION,
    model,
  });

  const hit = await cacheGet<Extract<ExplainResponse, { mode: "ai" }>>(store, key);
  if (hit) return { ...hit, cached: true };

  const rate = await checkRate(store, config, hashIp(deps.ip ?? "unknown"));
  if (!rate.ok) return { mode: "baseline", reason: rate.reason, message: UNAVAILABLE_TEXT[rate.reason], retryable: rate.reason === "rate_limited" };

  const adapter = deps.adapter ?? createAdapter(config);
  let lastError = "provider";
  for (let attempt = 0; attempt < 2; attempt++) {
    const q = await consumeQuota(store, config);
    if (!q.ok) return { mode: "baseline", reason: q.reason, message: UNAVAILABLE_TEXT[q.reason], retryable: false };
    try {
      const res = await adapter.generate({
        system: RECOMMEND_SYSTEM,
        user: buildUserMessage(pack),
        schema: AiRecommendationSchema,
        maxTokens: config.maxOutputTokens,
        timeoutMs: config.timeoutMs,
        fixture: () => fixtureExplanation(pack, process.env.AI_FIXTURE_MODE ?? "ok"),
      });
      const v = validateExplanation(res.data, pack);
      if (!v.usable) {
        lastError = "invalid_output";
        continue; // 输出不可用时最多重试一次
      }
      const { issues, ...rest } = v;
      const out: Extract<ExplainResponse, { mode: "ai" }> = {
        mode: "ai",
        fixture,
        cached: false,
        generated_at: (deps.now?.() ?? new Date()).toISOString(),
        explanation: { ...rest, removed: issues.length },
        versions: { prompt: RECOMMEND_PROMPT_VERSION, data: c.versions.data, labels: c.versions.labels },
      };
      await cacheSet(store, key, out);
      return out;
    } catch (e) {
      lastError = e instanceof AiError ? e.kind : "provider";
    }
  }
  const message =
    lastError === "timeout"
      ? "生成个性化解释超时，已保留基础模式结果，可以稍后重试。"
      : lastError === "invalid_output"
        ? "生成的解释没有通过引用与数字校验，已改用基础模式结果。"
        : "个性化解释服务暂时出错，已保留基础模式结果，可以稍后重试。";
  return { mode: "baseline", reason: lastError, message, retryable: lastError !== "invalid_output" };
}
