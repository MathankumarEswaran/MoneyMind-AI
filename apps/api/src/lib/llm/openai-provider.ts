import { env } from "../../config/env.js";
import { AppError } from "../app-error.js";
import type { ChatCompletionRequest, ChatCompletionResponse, LlmProvider } from "./provider.js";

export class OpenAiProvider implements LlmProvider {
  readonly name = "openai";

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!env.ai.apiKey) {
      throw new AppError(503, "AI_NOT_CONFIGURED", "AI provider is not configured.");
    }

    const baseUrl = env.ai.baseUrl || "https://api.openai.com/v1";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.ai.timeoutMs);

    try {
      const body: Record<string, unknown> = {
        model: request.model || env.ai.model,
        messages: request.messages,
        temperature: request.temperature ?? env.ai.temperature,
        max_tokens: request.maxTokens ?? env.ai.maxTokens,
      };

      if (request.tools && request.tools.length > 0) {
        body.tools = request.tools.map((tool) => ({
          type: "function",
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        }));
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ai.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(502, "AI_PROVIDER_ERROR", "The AI provider request failed.");
      }

      const json = (await response.json()) as {
        choices?: Array<{
          message?: {
            role?: string;
            content?: string | null;
            tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }>;
          };
          finish_reason?: string | null;
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };

      const choices: ChatCompletionResponse["choices"] = (json.choices || []).map((choice) => {
        const msg = choice.message || {};
        const toolCalls = (msg.tool_calls || []).map((tc) => ({
          id: tc.id || crypto.randomUUID(),
          name: tc.function?.name || "",
          arguments: tc.function?.arguments || "{}",
        }));

        return {
          message: {
            role: (msg.role as "assistant") || "assistant",
            content: msg.content || "",
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finishReason: choice.finish_reason || null,
        };
      });

      return {
        choices,
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens || 0,
              completionTokens: json.usage.completion_tokens || 0,
              totalTokens: json.usage.total_tokens || 0,
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
