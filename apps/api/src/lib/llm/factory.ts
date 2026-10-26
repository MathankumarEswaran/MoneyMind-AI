import { env } from "../../config/env.js";
import { AppError } from "../app-error.js";
import { AnthropicProvider } from "./anthropic-provider.js";
import { OllamaProvider } from "./ollama-provider.js";
import { OpenAiProvider } from "./openai-provider.js";
import type { LlmProvider } from "./provider.js";

let cachedProvider: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (cachedProvider) return cachedProvider;

  if (env.ai.provider === "openai") {
    cachedProvider = new OpenAiProvider();
    return cachedProvider;
  }
  if (env.ai.provider === "anthropic") {
    cachedProvider = new AnthropicProvider();
    return cachedProvider;
  }
  if (env.ai.provider === "ollama") {
    cachedProvider = new OllamaProvider();
    return cachedProvider;
  }

  throw new AppError(503, "AI_NOT_CONFIGURED", "AI provider is not configured.");
}
