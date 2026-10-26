import { env } from "../../config/env.js";
import { AppError } from "../app-error.js";
import type { ChatCompletionRequest, ChatCompletionResponse, LlmProvider } from "./provider.js";

export class OllamaProvider implements LlmProvider {
  readonly name = "ollama";

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const baseUrl = env.ai.baseUrl || "http://localhost:11434";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ai.timeoutMs);

    try {
      const body = {
        model: request.model || env.ai.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? env.ai.temperature,
          num_predict: request.maxTokens ?? env.ai.maxTokens,
        },
      };

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(502, "AI_PROVIDER_ERROR", "The AI provider request failed.");
      }

      const json = (await response.json()) as {
        message?: { role?: string; content?: string };
        prompt_eval_count?: number;
        eval_count?: number;
      };

      return {
        choices: [
          {
            message: {
              role: "assistant",
              content: json.message?.content || "",
            },
            finishReason: "stop",
          },
        ],
        usage: {
          promptTokens: json.prompt_eval_count || 0,
          completionTokens: json.eval_count || 0,
          totalTokens: (json.prompt_eval_count || 0) + (json.eval_count || 0),
        },
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
