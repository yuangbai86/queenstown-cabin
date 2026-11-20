import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { AiConfig } from "./config";

/**
 * 可替换的模型适配层。上层只关心：给定系统提示、用户内容和输出结构，返回“未经校验的数据”。
 * 输出永远要再经过业务校验（引用编号、数字、摘录）。
 */
export interface GenerateRequest<T extends z.ZodType> {
  system: string;
  user: string;
  schema: T;
  maxTokens: number;
  timeoutMs: number;
  /** 测试夹具使用 */
  fixture?: () => unknown;
}

export interface GenerateResult {
  data: unknown;
  usage: { input_tokens: number | null; output_tokens: number | null };
  model: string;
}

export class AiError extends Error {
  constructor(public kind: "timeout" | "provider" | "refusal" | "parse", message: string) {
    super(message);
  }
}

export interface AiAdapter {
  generate<T extends z.ZodType>(req: GenerateRequest<T>): Promise<GenerateResult>;
}

class AnthropicAdapter implements AiAdapter {
  private client: Anthropic;
  constructor(private c: AiConfig) {
    this.client = new Anthropic({ apiKey: c.apiKey!, baseURL: c.baseUrl ?? undefined, maxRetries: 0 });
  }
  async generate<T extends z.ZodType>(req: GenerateRequest<T>): Promise<GenerateResult> {
    try {
      const res = await this.client.messages.parse(
        {
          model: this.c.model!,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
          output_config: { effort: "low", format: zodOutputFormat(req.schema) },
        },
        { timeout: req.timeoutMs },
      );
      if (res.stop_reason === "refusal") throw new AiError("refusal", "model declined");
      if (res.parsed_output == null) throw new AiError("parse", "no parsed output");
      return {
        data: res.parsed_output,
        usage: { input_tokens: res.usage.input_tokens ?? null, output_tokens: res.usage.output_tokens ?? null },
        model: res.model,
      };
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiError("timeout", "timeout");
      if (e instanceof Anthropic.APIError) throw new AiError("provider", `status ${e.status ?? "?"}`);
      throw new AiError("provider", "unknown");
    }
  }
}

/** OpenAI 兼容接口（如自建网关）。地址只来自服务端配置。 */
class OpenAICompatibleAdapter implements AiAdapter {
  constructor(private c: AiConfig) {}
  async generate<T extends z.ZodType>(req: GenerateRequest<T>): Promise<GenerateResult> {
    if (!this.c.baseUrl) throw new AiError("provider", "missing base url");
    const url = new URL("chat/completions", this.c.baseUrl.endsWith("/") ? this.c.baseUrl : `${this.c.baseUrl}/`);
    if (url.protocol !== "https:" && !this.c.isDev) throw new AiError("provider", "https required");
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.c.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.c.model,
          max_tokens: req.maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${req.system}\n\n输出必须是单个 JSON 对象。` },
            { role: "user", content: req.user },
          ],
        }),
        signal: AbortSignal.timeout(req.timeoutMs),
        cache: "no-store",
      });
    } catch (e) {
      throw new AiError((e as Error).name === "TimeoutError" ? "timeout" : "provider", "request failed");
    }
    if (!res.ok) throw new AiError("provider", `status ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
    const text = body.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AiError("parse", "invalid json");
    }
    const check = req.schema.safeParse(parsed);
    if (!check.success) throw new AiError("parse", "schema mismatch");
    return {
      data: check.data,
      usage: { input_tokens: body.usage?.prompt_tokens ?? null, output_tokens: body.usage?.completion_tokens ?? null },
      model: body.model ?? this.c.model ?? "unknown",
    };
  }
}

/**
 * 测试夹具：仅本地开发可用，返回由调用方构造的确定性输出，并在界面标注“测试夹具”。
 * 可通过 AI_FIXTURE_MODE 模拟 timeout / error / bad_citation，用于检查回退界面。
 */
class FixtureAdapter implements AiAdapter {
  async generate<T extends z.ZodType>(req: GenerateRequest<T>): Promise<GenerateResult> {
    const mode = process.env.AI_FIXTURE_MODE ?? "ok";
    await new Promise((r) => setTimeout(r, Number(process.env.AI_FIXTURE_DELAY_MS ?? 900)));
    if (mode === "timeout") throw new AiError("timeout", "fixture timeout");
    if (mode === "error") throw new AiError("provider", "fixture error");
    const data = req.fixture ? req.fixture() : {};
    return { data, usage: { input_tokens: null, output_tokens: null }, model: "fixture" };
  }
}

export function createAdapter(c: AiConfig): AiAdapter {
  if (c.provider === "fixture") return new FixtureAdapter();
  if (c.provider === "openai_compatible") return new OpenAICompatibleAdapter(c);
  return new AnthropicAdapter(c);
}
