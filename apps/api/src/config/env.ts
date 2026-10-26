import "dotenv/config";
import { z } from "zod";

const BooleanStringSchema = z.enum(["true", "false"]).optional();

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    HOST: z.string().min(1).default("0.0.0.0"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ORIGINS: z.string().default("http://localhost:5173"),
    TRUST_PROXY: BooleanStringSchema,
    BODY_LIMIT: z.string().default("1mb"),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),

    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine(
        (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "DATABASE_URL must be a PostgreSQL connection string",
      ),
    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/, "COOKIE_NAME may only contain letters, numbers, _ and -")
      .default("mm_refresh"),
    COOKIE_DOMAIN: z.string().min(1).optional(),
    COOKIE_SECURE: BooleanStringSchema,
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

    AI_PROVIDER: z.enum(["openai", "anthropic", "ollama", "none"]).default("none"),
    AI_API_KEY: z.string().optional(),
    AI_BASE_URL: z.string().url().optional().or(z.literal("")),
    AI_MODEL: z.string().min(1).default("gpt-4o-mini"),
    AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
    AI_MAX_TOKENS: z.coerce.number().int().min(1).max(4096).default(1024),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    AI_MAX_TOOL_ITERATIONS: z.coerce.number().int().min(1).max(10).default(5),
    AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
    AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    AI_MONTHLY_TOKEN_QUOTA: z.coerce.number().int().positive().default(100_000),
    AI_MONTHLY_COST_QUOTA_USD: z.coerce.number().min(0).default(10),

    EMBEDDING_PROVIDER: z.enum(["openai", "ollama", "none"]).default("openai"),
    EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

    QDRANT_URL: z.string().url().default("http://localhost:6333"),
    QDRANT_API_KEY: z.string().optional(),
    QDRANT_COLLECTION: z.string().min(1).default("moneymind_documents"),

    UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10_485_760),
    UPLOAD_ALLOWED_MIME: z.string().default("application/pdf,text/plain,text/markdown,text/csv,application/csv"),
    UPLOAD_STORAGE_DIR: z.string().min(1).default("./uploads"),
  })
  .superRefine((value, ctx) => {
    if (value.JWT_ACCESS_SECRET === value.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET",
      });
    }
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  • ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = parsed.data;
const isTest = raw.NODE_ENV === "test";
const isProd = raw.NODE_ENV === "production";

export const env = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isDev: raw.NODE_ENV === "development",
  isProd,
  isTest,
  port: raw.PORT,
  host: raw.HOST,
  logLevel: isTest ? ("silent" as const) : raw.LOG_LEVEL,
  corsOrigins: raw.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: raw.TRUST_PROXY === "true",
  bodyLimit: raw.BODY_LIMIT,
  rateLimit: {
    windowMs: raw.RATE_LIMIT_WINDOW_MS,
    max: raw.RATE_LIMIT_MAX,
  },
  databaseUrl: raw.DATABASE_URL,
  auth: Object.freeze({
    accessSecret: raw.JWT_ACCESS_SECRET,
    refreshSecret: raw.JWT_REFRESH_SECRET,
    accessTokenTtlSeconds: raw.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlMs: raw.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    cookie: Object.freeze({
      name: raw.COOKIE_NAME,
      domain: raw.COOKIE_DOMAIN,
      secure: raw.COOKIE_SECURE ? raw.COOKIE_SECURE === "true" : isProd,
      sameSite: "strict" as const,
      path: "/api/v1/auth",
    }),
    rateLimit: Object.freeze({
      windowMs: raw.AUTH_RATE_LIMIT_WINDOW_MS,
      max: raw.AUTH_RATE_LIMIT_MAX,
    }),
  }),
  ai: Object.freeze({
    provider: raw.AI_PROVIDER,
    apiKey: raw.AI_API_KEY || undefined,
    baseUrl: raw.AI_BASE_URL || undefined,
    model: raw.AI_MODEL,
    temperature: raw.AI_TEMPERATURE,
    maxTokens: raw.AI_MAX_TOKENS,
    timeoutMs: raw.AI_REQUEST_TIMEOUT_MS,
    maxToolIterations: raw.AI_MAX_TOOL_ITERATIONS,
    rateLimit: Object.freeze({
      windowMs: raw.AI_RATE_LIMIT_WINDOW_MS,
      max: raw.AI_RATE_LIMIT_MAX,
    }),
    monthlyTokenQuota: raw.AI_MONTHLY_TOKEN_QUOTA,
    monthlyCostQuotaUsd: raw.AI_MONTHLY_COST_QUOTA_USD,
  }),
  embeddings: Object.freeze({
    provider: raw.EMBEDDING_PROVIDER,
    model: raw.EMBEDDING_MODEL,
    dimensions: raw.EMBEDDING_DIMENSIONS,
  }),
  qdrant: Object.freeze({
    url: raw.QDRANT_URL,
    apiKey: raw.QDRANT_API_KEY || undefined,
    collection: raw.QDRANT_COLLECTION,
  }),
  upload: Object.freeze({
    maxBytes: raw.UPLOAD_MAX_BYTES,
    allowedMime: raw.UPLOAD_ALLOWED_MIME.split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    storageDir: raw.UPLOAD_STORAGE_DIR,
  }),
});

export type Env = typeof env;
