/** 把 src/lib/ai/prompts.ts 中的提示词导出为 prompts/*.md，便于审阅。测试会检查两者一致。 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXTRACT_PROMPT_VERSION, EXTRACT_SYSTEM, RECOMMEND_PROMPT_VERSION, RECOMMEND_SYSTEM } from "../src/lib/ai/prompts";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../prompts");
mkdirSync(dir, { recursive: true });
export const render = (title: string, version: string, body: string, note: string) =>
  `# ${title}\n\n版本：\`${version}\`（唯一来源：\`src/lib/ai/prompts.ts\`，本文件由 \`npm run export-prompts\` 生成）\n\n${note}\n\n## 系统提示词\n\n\`\`\`text\n${body}\n\`\`\`\n`;
writeFileSync(
  path.join(dir, "extract.md"),
  render("评论维度提取提示词", EXTRACT_PROMPT_VERSION, EXTRACT_SYSTEM, "用户消息为 JSON 数组 `[{id, text}]`；输出结构见 `src/lib/import/service.ts` 中的 `ExtractSchema`。程序随后校验编号、维度、情绪和摘录是否逐字出现在原文中。"),
);
writeFileSync(
  path.join(dir, "recommend.md"),
  render("个性化解释提示词", RECOMMEND_PROMPT_VERSION, RECOMMEND_SYSTEM, "用户消息为 `buildPack()` 生成的压缩材料（不含评论原文）；输出结构见 `AiRecommendationSchema`。程序随后校验状态不得更激进、引用编号必须存在、数字＋单位必须来自材料。"),
);
console.log("prompts exported");
