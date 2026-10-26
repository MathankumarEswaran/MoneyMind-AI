import { createHash, randomUUID } from "node:crypto";
import type { Request } from "express";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { env } from "../../config/env.js";
import { saveUpload } from "../../lib/storage/uploads.js";
import { qdrantClient } from "../../lib/qdrant/client.js";
import { getEmbeddingProvider } from "../../lib/embeddings/factory.js";
import type { DocumentContext } from "./documents.context.js";
import { chunkText } from "./documents.utils.js";

export async function listDocuments(ctx: DocumentContext) {
  const docs = await prisma.document.findMany({
    where: { userId: ctx.userId, workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
  });
  return {
    documents: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      chunkCount: d.chunkCount,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      error: d.error,
    })),
  };
}

export async function getDocument(ctx: DocumentContext, id: string) {
  const doc = await prisma.document.findFirst({
    where: { id, userId: ctx.userId, workspaceId: ctx.workspaceId },
  });
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
  return {
    document: {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      error: doc.error,
    },
  };
}

export async function uploadDocument(ctx: DocumentContext, req: Request) {
  if (!req.file) {
    throw new AppError(400, "NO_FILE", "No file uploaded.");
  }
  if (req.file.size > env.upload.maxBytes) {
    throw new AppError(400, "FILE_TOO_LARGE", "File exceeds size limit.");
  }
  if (!env.upload.allowedMime.includes(req.file.mimetype)) {
    throw new AppError(400, "UNSUPPORTED_MIME", "File type not allowed.");
  }

  const checksumSha256 = createHash("sha256").update(req.file.buffer).digest("hex");
  const existing = await prisma.document.findFirst({
    where: { workspaceId: ctx.workspaceId, checksumSha256 },
  });
  if (existing) {
    throw new AppError(409, "DUPLICATE_DOCUMENT", "This document has already been uploaded.");
  }

  const { storageKey } = await saveUpload(req.file.buffer, req.file.originalname);
  const doc = await prisma.document.create({
    data: {
      id: randomUUID(),
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storageKey,
      checksumSha256,
      status: "UPLOADED",
      chunkCount: 0,
    },
  });

  // Process asynchronously in background
  void processDocument(ctx, doc.id).catch(() => undefined);

  return {
    document: {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      chunkCount: doc.chunkCount,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      error: doc.error,
    },
  };
}

async function processDocument(ctx: DocumentContext, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, userId: ctx.userId, workspaceId: ctx.workspaceId },
  });
  if (!doc) return;

  await prisma.document.update({
    where: { id: doc.id },
    data: { status: "PROCESSING", error: null },
  });

  try {
    const { readUpload } = await import("../../lib/storage/uploads.js");
    const buffer = await readUpload(doc.storageKey);
    let text = "";

    if (doc.mimeType === "application/pdf") {
      // Simple text extraction fallback - in production use pdf-parse
      text = buffer.toString("utf-8");
    } else {
      text = buffer.toString("utf-8");
    }

    const chunks = chunkText(text);
    await qdrantClient.ensureCollection(env.embeddings.dimensions);
    const embedder = getEmbeddingProvider();
    const embeddings = await embedder.embed(chunks);

    const points = chunks.map((chunk, idx) => ({
      id: `${doc.id}-${idx}`,
      vector: embeddings[idx] || [],
      payload: {
        documentId: doc.id,
        userId: ctx.userId,
        workspaceId: ctx.workspaceId,
        filename: doc.filename,
        chunkIndex: idx,
        text: chunk.slice(0, 1000),
      },
    }));

    await qdrantClient.upsert(points);
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "READY", chunkCount: chunks.length },
    });
  } catch (error) {
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "FAILED", error: (error as Error).message.slice(0, 500) },
    });
  }
}

export async function deleteDocument(ctx: DocumentContext, id: string) {
  const doc = await prisma.document.findFirst({
    where: { id, userId: ctx.userId, workspaceId: ctx.workspaceId },
  });
  if (!doc) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
  await qdrantClient.deleteByDocument(doc.id, ctx.userId, ctx.workspaceId);
  await prisma.document.delete({ where: { id: doc.id } });
}
