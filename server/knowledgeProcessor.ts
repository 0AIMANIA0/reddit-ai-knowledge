import { invokeLLM, listLLMModels } from "./_core/llm";

export type JapaneseEnrichment = {
  titleJa: string;
  bodyJa: string;
  summaryJa: string;
  category: string;
  tags: string[];
};

let modelPromise: Promise<string> | undefined;

async function resolveProcessingModel() {
  if (!modelPromise) {
    modelPromise = listLLMModels().then(({ data }) => {
      const preferred = data.find(model => model.id === "gpt-5-mini")?.id;
      const lowCost = data.find(model => model.id.startsWith("gpt-5-mini"))?.id;
      const fallback = data[0]?.id;
      if (!preferred && !lowCost && !fallback) throw new Error("利用可能なLLMモデルが見つかりません。");
      return preferred ?? lowCost ?? fallback!;
    });
  }
  return modelPromise;
}

function asText(value: string | Array<unknown>) {
  if (typeof value === "string") return value;
  return value.map(item => (typeof item === "object" && item && "text" in item ? String((item as { text: unknown }).text) : "")).join("");
}

export async function enrichEnglishText(input: { title: string; body: string; sourceKind: "post" | "comment" }): Promise<JapaneseEnrichment> {
  const model = await resolveProcessingModel();
  const sourceBody = input.body.slice(0, 14_000);
  const response = await invokeLLM({
    model,
    maxTokens: 1800,
    messages: [
      {
        role: "system",
        content:
          "You translate and curate English AI-community content for a Japanese knowledge base. Preserve factual uncertainty and product names. Do not invent facts. Return Japanese only in the requested JSON fields.",
      },
      {
        role: "user",
        content: `Source kind: ${input.sourceKind}\nTitle:\n${input.title}\n\nBody:\n${sourceBody}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "japanese_reddit_enrichment",
        strict: true,
        schema: {
          type: "object",
          properties: {
            titleJa: { type: "string" },
            bodyJa: { type: "string" },
            summaryJa: { type: "string" },
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" }, maxItems: 8 },
          },
          required: ["titleJa", "bodyJa", "summaryJa", "category", "tags"],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = asText(response.choices[0]?.message.content ?? "");
  const parsed = JSON.parse(raw) as JapaneseEnrichment;
  if (!parsed.titleJa || !parsed.bodyJa || !parsed.summaryJa || !parsed.category || !Array.isArray(parsed.tags)) {
    throw new Error("LLM応答の必要項目が不足しています。");
  }
  return { ...parsed, tags: parsed.tags.map(tag => tag.trim()).filter(Boolean).slice(0, 8) };
}
