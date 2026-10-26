import { env } from "../../config/env.js";
import { AppError } from "../app-error.js";

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export class QdrantClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.qdrant.url.replace(/\/$/, "");
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.qdrant.apiKey) {
      headers["api-key"] = env.qdrant.apiKey;
    }
    return headers;
  }

  async ensureCollection(dimensions: number): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/collections/${env.qdrant.collection}`, {
        headers: this.headers(),
      });
      if (res.ok) return;

      const createRes = await fetch(`${this.baseUrl}/collections/${env.qdrant.collection}`, {
        method: "PUT",
        headers: this.headers(),
        body: JSON.stringify({
          vectors: {
            size: dimensions,
            distance: "Cosine",
          },
        }),
      });
      if (!createRes.ok) {
        throw new AppError(502, "QDRANT_ERROR", "Failed to initialize vector collection.");
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, "QDRANT_ERROR", "Failed to connect to Qdrant.");
    }
  }

  async upsert(points: QdrantPoint[]): Promise<void> {
    const res = await fetch(`${this.baseUrl}/collections/${env.qdrant.collection}/points?wait=true`, {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({ points }),
    });
    if (!res.ok) {
      throw new AppError(502, "QDRANT_ERROR", "Failed to store vectors in Qdrant.");
    }
  }

  async search(params: {
    vector: number[];
    limit: number;
    filter: Record<string, unknown>;
  }): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
    const res = await fetch(`${this.baseUrl}/collections/${env.qdrant.collection}/points/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        vector: params.vector,
        limit: params.limit,
        filter: params.filter,
        with_payload: true,
      }),
    });
    if (!res.ok) {
      throw new AppError(502, "QDRANT_ERROR", "Failed to search vectors in Qdrant.");
    }
    const json = (await res.json()) as { result?: Array<{ id: string; score: number; payload: Record<string, unknown> }> };
    return json.result || [];
  }

  async deleteByDocument(documentId: string, userId: string, workspaceId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/collections/${env.qdrant.collection}/points/delete?wait=true`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        filter: {
          must: [
            { key: "documentId", match: { value: documentId } },
            { key: "userId", match: { value: userId } },
            { key: "workspaceId", match: { value: workspaceId } },
          ],
        },
      }),
    });
    if (!res.ok) {
      throw new AppError(502, "QDRANT_ERROR", "Failed to delete vectors from Qdrant.");
    }
  }
}

export const qdrantClient = new QdrantClient();
