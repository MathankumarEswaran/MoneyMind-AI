import { env } from "../../config/env.js";
import { AppError } from "../app-error.js";
import { OllamaEmbeddingProvider } from "./ollama-embedding.js";
import { OpenAiEmbeddingProvider } from "./openai-embedding.js";
import type { EmbeddingProvider } from "./provider.js";

let cached: EmbeddingProvider | null = null;

export function getEmbeddingProvider(): EmbeddingProvider {
  if (cached) return cached;
  if (env.embeddings.provider === "openai") {
    cached = new OpenAiEmbeddingProvider();
    return cached;
  }
  if (env.embeddings.provider === "ollama") {
    cached = new OllamaEmbeddingProvider();
    return cached;
  }
  throw new AppError(503, "EMBEDDING_NOT_CONFIGURED", "Embedding provider is not configured.");
}
