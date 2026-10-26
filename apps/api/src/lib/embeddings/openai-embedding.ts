import { env } from "../../config/env.js";
import { AppError } from "../app-error.js";
import type { EmbeddingProvider } from "./provider.js";

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";

  async embed(texts: string[]): Promise<number[][]> {
    if (!env.ai.apiKey) {
      throw new AppError(503, "EMBEDDING_NOT_CONFIGURED", "Embedding provider is not configured.");
    }
    const baseUrl = env.ai.baseUrl || "https://api.openai.com/v1";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ai.timeoutMs);

    try {
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ai.apiKey}`,
        },
        body: JSON.stringify({
          model: env.embeddings.model,
          input: texts,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new AppError(502, "EMBEDDING_PROVIDER_ERROR", "Embedding generation failed.");
      }

      const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      return (json.data || []).map((d) => d.embedding || []);
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new AppError(504, "EMBEDDING_TIMEOUT", "Embedding request timed out.");
      }
      if (error instanceof AppError) throw error;
      throw new AppError(502, "EMBEDDING_PROVIDER_ERROR", "Embedding generation failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
