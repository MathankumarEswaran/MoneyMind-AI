import { randomUUID } from "node:crypto";
import type { AiChatRequest, AiMessage, AiThread, AiThreadDetail } from "@moneymind/shared";
import { AppError } from "../../lib/app-error.js";
import { env } from "../../config/env.js";
import { getLlmProvider } from "../../lib/llm/factory.js";
import type { AiContext } from "./ai.context.js";
import {
  buildFinancialContext,
  buildSystemPrompt,
  generateSuggestions,
  isFinancialQuery,
} from "./ai.tools.js";
import { executeTool, TOOL_DEFINITIONS } from "./ai.tools.registry.js";

const threads = new Map<
  string,
  {
    id: string;
    userId: string;
    workspaceId: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    messages: AiMessage[];
  }
>();

const disclaimer =
  "This is AI-generated analysis, not guaranteed or authoritative financial advice. Always verify important decisions against your records and consider speaking with a qualified professional.";

function getUserThreads(userId: string): AiThread[] {
  const result: AiThread[] = [];
  for (const thread of threads.values()) {
    if (thread.userId === userId) {
      result.push({
        id: thread.id,
        title: thread.title,
        createdAt: thread.createdAt.toISOString(),
        updatedAt: thread.updatedAt.toISOString(),
        messageCount: thread.messages.length,
      });
    }
  }
  return result.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

function getUserThreadDetail(userId: string, threadId: string): AiThreadDetail {
  const thread = threads.get(threadId);
  if (!thread || thread.userId !== userId) {
    throw new AppError(404, "AI_THREAD_NOT_FOUND", "That conversation does not exist.");
  }
  return {
    thread: {
      id: thread.id,
      title: thread.title,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      messageCount: thread.messages.length,
    },
    messages: thread.messages,
    disclaimer,
  };
}

export async function listThreads(ctx: AiContext): Promise<{ threads: AiThread[] }> {
  return { threads: getUserThreads(ctx.userId) };
}

export async function getThread(ctx: AiContext, threadId: string): Promise<AiThreadDetail> {
  return getUserThreadDetail(ctx.userId, threadId);
}

export async function chat(ctx: AiContext, input: AiChatRequest): Promise<{
  threadId: string;
  message: AiMessage;
  suggestedQuestions: string[];
  disclaimer: string;
}> {
  if (env.ai.provider === "none") {
    throw new AppError(503, "AI_NOT_CONFIGURED", "AI provider is not configured. Set AI_PROVIDER and AI_API_KEY.");
  }

  const financialQuery = isFinancialQuery(input.message);

  let thread: NonNullable<ReturnType<typeof threads.get>>;
  if (input.threadId) {
    const existing = threads.get(input.threadId);
    if (!existing || existing.userId !== ctx.userId || existing.workspaceId !== ctx.workspaceId) {
      throw new AppError(404, "AI_THREAD_NOT_FOUND", "That conversation does not exist.");
    }
    thread = existing;
  } else {
    thread = {
      id: randomUUID(),
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      title: input.message.slice(0, 60),
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    };
    threads.set(thread.id, thread);
  }

  const userMessage: AiMessage = {
    id: randomUUID(),
    role: "user",
    content: input.message,
    createdAt: new Date().toISOString(),
  };
  thread.messages.push(userMessage);

  const contextText = input.includeContext
    ? await buildFinancialContext(ctx)
    : "No financial context provided.";
  const citations = financialQuery ? [] : [];

  let assistantContent = "I couldn't generate a response. Please try again.";
  const toolCalls: AiMessage["toolCalls"] = [];

  try {
    const provider = getLlmProvider();
    const systemPrompt = `${buildSystemPrompt(ctx, contextText, financialQuery)}\n\nYou are MoneyMind Copilot. All financial amounts are in Indian Rupees (INR). Always use ₹ and Indian number formatting (₹1,00,000). Never return USD or $. Use tools when you need real application data. Never invent values. Never modify financial records without explicit user confirmation. For destructive/important actions, ask for confirmation first.\nAvailable tools: ${TOOL_DEFINITIONS.map((t) => t.name).join(", ")}.`;
    const history = thread.messages.slice(-12).map((m) => ({
      role: m.role === "tool" ? ("assistant" as const) : m.role,
      content: m.content,
    }));

    const tools = TOOL_DEFINITIONS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: t.parameters.properties || {},
        required: (t.parameters.required as string[]) || [],
      },
    }));

    const messages: Array<{ role: "system" | "user" | "assistant" | "tool"; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    // Simple tool-calling loop (max iterations)
    for (let i = 0; i < env.ai.maxToolIterations; i++) {
      const response = await provider.chatCompletion({
        messages,
        tools: tools as Array<{ name: string; description: string; parameters: Record<string, unknown> }>,
        temperature: env.ai.temperature,
        maxTokens: env.ai.maxTokens,
      });

      const choice = response.choices[0];
      const toolCallsFromResponse = choice?.message.toolCalls;

      if (toolCallsFromResponse && toolCallsFromResponse.length > 0 && choice.message.content === "") {
        for (const tc of toolCallsFromResponse) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.arguments || "{}");
          } catch {
            args = {};
          }
          try {
            const result = await executeTool(ctx, tc.name, args);
            toolCalls.push({
              id: tc.id,
              name: tc.name,
              arguments: args,
              result,
            });
            messages.push({ role: "assistant", content: `Called tool ${tc.name} with arguments ${JSON.stringify(args)}` });
            messages.push({ role: "tool", content: JSON.stringify(result) });
          } catch (error) {
            toolCalls.push({
              id: tc.id,
              name: tc.name,
              arguments: args,
              result: { error: (error as Error).message },
            });
            messages.push({ role: "tool", content: JSON.stringify({ error: (error as Error).message }) });
          }
        }
        continue;
      }

      assistantContent = choice?.message.content || "I couldn't generate a response. Please try again.";
      break;
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new AppError(502, "AI_PROVIDER_ERROR", `The AI assistant encountered an error: ${message}`);
  }

  const assistantMessage: AiMessage = {
    id: randomUUID(),
    role: "assistant",
    content: assistantContent,
    createdAt: new Date().toISOString(),
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    citations: citations.length > 0 ? citations : undefined,
  };
  thread.messages.push(assistantMessage);
  thread.updatedAt = new Date();
  if (thread.messages.length === 2 && thread.title.length === 60) {
    thread.title = input.message.slice(0, 80);
  }

  return {
    threadId: thread.id,
    message: assistantMessage,
    suggestedQuestions: generateSuggestions(financialQuery),
    disclaimer,
  };
}
