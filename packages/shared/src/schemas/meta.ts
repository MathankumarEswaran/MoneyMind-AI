import { z } from "zod";
import { APP_NAME } from "../constants.js";
import { EnvironmentSchema } from "./health.js";

export const FeatureFlagsSchema = z.object({
  authentication: z.boolean(),
  database: z.boolean(),
  transactions: z.boolean(),
  budgets: z.boolean(),
  goals: z.boolean(),
  analytics: z.boolean(),
  aiChat: z.boolean(),
  rag: z.boolean(),
  vectorSearch: z.boolean(),
});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

export const MetaResponseSchema = z.object({
  data: z.object({
    name: z.literal(APP_NAME),
    version: z.string().min(1),
    phase: z.number().int().min(1),
    environment: EnvironmentSchema,
    features: FeatureFlagsSchema,
    timestamp: z.iso.datetime(),
  }),
});

export type MetaResponse = z.infer<typeof MetaResponseSchema>;
