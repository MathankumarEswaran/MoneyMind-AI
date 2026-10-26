import { env } from "../../config/env.js";
import { AppError } from "../app-error.js";
import type { EmbeddingProvider } from "./provider.js";

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = "ollama";

  async embed(texts: string[]): Promise<number[][]> {
    const baseUrl = env.ai.baseUrl || "http://localhost:11434";
    const results: number[][] = [];

    for (const text of texts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), env.ai.timeoutMs);
      try {
        const res = await fetch(`${baseUrl}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: env.embeddings.model, prompt: text }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new AppError(502, "EMBEDDING_PROVIDER_ERROR", "Embedding generation failed.");
        }
        const json = (await res.json()) as { embedding?: number[] };
        results.push(json.embedding || []);
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
    return results;
  }
}
