import { z } from "zod";

export const DocumentStatusSchema = z.enum(["UPLOADED", "PROCESSING", "READY", "FAILED"]);

export const DocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  status: DocumentStatusSchema,
  chunkCount: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  error: z.string().nullable().optional(),
});

export const DocumentListResponseSchema = z.object({
  data: z.object({
    documents: z.array(DocumentSchema),
  }),
});

export const DocumentUploadResponseSchema = z.object({
  data: z.object({
    document: DocumentSchema,
  }),
});

export const DocumentDetailResponseSchema = z.object({
  data: z.object({
    document: DocumentSchema,
  }),
});

export const RAGQueryRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  limit: z.number().int().min(1).max(10).default(5),
  threadId: z.string().optional(),
});

export const RAGSourceSchema = z.object({
  documentId: z.string(),
  filename: z.string(),
  chunkIndex: z.number().int(),
  score: z.number(),
  excerpt: z.string(),
});

export const RAGQueryResponseSchema = z.object({
  data: z.object({
    answer: z.string(),
    sources: z.array(RAGSourceSchema),
    disclaimer: z.string(),
  }),
});

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type RAGQueryRequest = z.infer<typeof RAGQueryRequestSchema>;
export type RAGSource = z.infer<typeof RAGSourceSchema>;
export type RAGQueryResponse = z.infer<typeof RAGQueryResponseSchema>;
