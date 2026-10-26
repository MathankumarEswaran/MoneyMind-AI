import { z } from "zod";
import { APP_VERSION } from "../constants.js";

export const ServiceNameSchema = z.literal("moneymind-api");
export const EnvironmentSchema = z.enum(["development", "test", "production"]);
export const HealthStatusSchema = z.enum(["ok", "degraded"]);
export const HealthCheckStatusSchema = z.enum(["up", "down", "degraded"]);

export const HealthResponseSchema = z.object({
  data: z.object({
    status: HealthStatusSchema,
    service: ServiceNameSchema,
    version: z.string().min(1),
    environment: EnvironmentSchema,
    uptimeSeconds: z.number().nonnegative(),
    timestamp: z.iso.datetime(),
    checks: z.record(z.string(), HealthCheckStatusSchema),
  }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type HealthCheckStatus = z.infer<typeof HealthCheckStatusSchema>;

/** Default version used when a service cannot resolve its own package version. */
export const FALLBACK_VERSION = APP_VERSION;
