import { z } from "zod";

/**
 * ISO 4217, three uppercase letters. Validated before it ever reaches the
 * database or an LLM prompt.
 */
export const CurrencySchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, "Expected a 3-letter ISO 4217 currency code");

export type Currency = z.infer<typeof CurrencySchema>;

/**
 * Money crosses every boundary as integer minor units (e.g. 1234 === $12.34)
 * encoded as a decimal string. This avoids IEEE-754 rounding in the ledger.
 */
export const MoneySchema = z.object({
  amountMinor: z.string().regex(/^-?\d+$/, "Amount must be an integer number of minor units"),
  currency: CurrencySchema,
});

export type Money = z.infer<typeof MoneySchema>;

export const SortOrderSchema = z.enum(["asc", "desc"]);
export type SortOrder = z.infer<typeof SortOrderSchema>;

export const PaginationQuerySchema = z.object({
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  order: SortOrderSchema.default("desc"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const PageMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type PageMeta = z.infer<typeof PageMetaSchema>;

export interface ApiSuccess<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
