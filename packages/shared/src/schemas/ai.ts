import { z } from "zod";

export const AiMessageRoleSchema = z.enum(["user", "assistant", "tool", "system"]);

export const AiMessageSchema = z.object({
  id: z.string(),
  role: AiMessageRoleSchema,
  content: z.string(),
  createdAt: z.iso.datetime(),
  toolCalls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        arguments: z.record(z.string(), z.unknown()),
        result: z.unknown().optional(),
      }),
    )
    .optional(),
  citations: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["transaction", "category", "budget", "goal"]),
        description: z.string(),
        amountMinor: z.string().optional(),
        occurredAt: z.string().optional(),
      }),
    )
    .optional(),
});

export const AiThreadSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  messageCount: z.number().int().nonnegative(),
});

export const AiChatRequestSchema = z.object({
  threadId: z.string().optional(),
  message: z.string().min(1).max(2000),
  includeContext: z.boolean().default(true),
});

export const AiChatResponseSchema = z.object({
  threadId: z.string(),
  message: AiMessageSchema,
  suggestedQuestions: z.array(z.string()).default([]),
  disclaimer: z.string(),
});

export const AiThreadsListSchema = z.object({
  threads: z.array(AiThreadSchema),
});

export const AiThreadDetailSchema = z.object({
  thread: AiThreadSchema,
  messages: z.array(AiMessageSchema),
  disclaimer: z.string(),
});

export type AiMessageRole = z.infer<typeof AiMessageRoleSchema>;
export type AiMessage = z.infer<typeof AiMessageSchema>;
export type AiThread = z.infer<typeof AiThreadSchema>;
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;
export type AiChatResponse = z.infer<typeof AiChatResponseSchema>;
export type AiThreadsList = z.infer<typeof AiThreadsListSchema>;
export type AiThreadDetail = z.infer<typeof AiThreadDetailSchema>;
