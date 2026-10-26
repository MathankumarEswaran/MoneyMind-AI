import { env } from "../../config/env.js";
import { AppError } from "../app-error.js";
import type { ChatCompletionRequest, ChatCompletionResponse, LlmProvider } from "./provider.js";

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!env.ai.apiKey) {
      throw new AppError(503, "AI_NOT_CONFIGURED", "AI provider is not configured.");
    }

    const baseUrl = env.ai.baseUrl || "https://api.anthropic.com/v1";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ai.timeoutMs);

    try {
      const systemMessages = request.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
      const userMessages = request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));

      const body: Record<string, unknown> = {
        model: request.model || env.ai.model,
        max_tokens: request.maxTokens ?? env.ai.maxTokens,
        temperature: request.temperature ?? env.ai.temperature,
        messages: userMessages,
      };
      if (systemMessages) body.system = systemMessages;

      const response = await fetch(`${baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ai.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(502, "AI_PROVIDER_ERROR", "The AI provider request failed.");
      }

      const json = (await response.json()) as {
        content?: Array<{ type?: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
        stop_reason?: string | null;
      };

      const text = (json.content || [])
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join("");

      return {
        choices: [
          {
            message: { role: "assistant", content: text },
            finishReason: json.stop_reason || null,
          },
        ],
        usage: json.usage
          ? {
              promptTokens: json.usage.input_tokens || 0,
              completionTokens: json.usage.output_tokens || 0,
              totalTokens: (json.usage.input_tokens || 0) + (json.usage.output_tokens || 0),
            }
          : undefined,
      };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new AppError(504, "AI_TIMEOUT", "The AI request timed out.");
      }
      if (error instanceof AppError) throw error;
      throw new AppError(502, "AI_PROVIDER_ERROR", "The AI provider request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
