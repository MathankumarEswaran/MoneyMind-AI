import type { AiContext } from "../ai/ai.context.js";
import { AppError } from "../../lib/app-error.js";
import { env } from "../../config/env.js";
import { getEmbeddingProvider } from "../../lib/embeddings/factory.js";
import { qdrantClient } from "../../lib/qdrant/client.js";
import { getLlmProvider } from "../../lib/llm/factory.js";
import { buildSystemPrompt } from "../ai/ai.tools.js";

const disclaimer =
  "This is AI-generated analysis using retrieved documents, not guaranteed or authoritative financial advice. Always verify important decisions against your records and consider speaking with a qualified professional.";

export async function queryRag(ctx: AiContext, input: { query: string; limit?: number }) {
  if (env.ai.provider === "none") {
    throw new AppError(503, "AI_NOT_CONFIGURED", "AI provider is not configured.");
  }

  await qdrantClient.ensureCollection(env.embeddings.dimensions);
  const embedder = getEmbeddingProvider();
  const [queryVector] = await embedder.embed([input.query]);

  const results = await qdrantClient.search({
    vector: queryVector,
    limit: input.limit || 5,
    filter: {
      must: [
        { key: "userId", match: { value: ctx.userId } },
        { key: "workspaceId", match: { value: ctx.workspaceId } },
      ],
    },
  });

  const sources = results.map((r) => ({
    documentId: String(r.payload.documentId || ""),
    filename: String(r.payload.filename || ""),
    chunkIndex: Number(r.payload.chunkIndex || 0),
    score: r.score,
    excerpt: String(r.payload.text || "").slice(0, 200),
  }));

  const context = sources
    .map((s, i) => `[Source ${i + 1}: ${s.filename} (chunk ${s.chunkIndex})]\n${results[i]?.payload.text || s.excerpt}`)
    .join("\n\n");

  const provider = getLlmProvider();
  const systemPrompt = `${buildSystemPrompt(ctx, "Document context provided below.", true)}\n\nUse ONLY the retrieved document excerpts to answer. If the answer is not in the documents, say so. Always cite sources by filename and chunk. Distinguish analysis from suggestions. All amounts are in INR (₹), use Indian formatting.\n\n${context}`;

  const response = await provider.chatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: input.query },
    ],
    temperature: env.ai.temperature,
    maxTokens: env.ai.maxTokens,
  });

  const answer = response.choices[0]?.message.content || "I could not find relevant information in your documents.";
  return { answer, sources, disclaimer };
}
