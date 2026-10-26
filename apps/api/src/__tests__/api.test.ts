import { describe, expect, it } from "vitest";
import request from "supertest";
import { HealthResponseSchema, MetaResponseSchema } from "@moneymind/shared";
import { createApp } from "../app.js";

const app = createApp();

describe("GET /api/v1/health", () => {
  it("returns a schema-valid liveness payload", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    const parsed = HealthResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.service).toBe("moneymind-api");
    expect(response.body.data.checks.api).toBe("up");
  });

  it("returns a correlation id on every response", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);
    expect(response.headers["x-request-id"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
  });

  it("echoes a safe inbound request id", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("x-request-id", "client-request-123")
      .expect(200);

    expect(response.headers["x-request-id"]).toBe("client-request-123");
  });

  it("replaces an unsafe inbound request id", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("x-request-id", "bad id with spaces")
      .expect(200);

    expect(response.headers["x-request-id"]).not.toBe("bad id with spaces");
    expect(response.headers["x-request-id"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
  });
});

describe("GET /api/v1/meta", () => {
  it("reports phase 3 capabilities", async () => {
    const response = await request(app).get("/api/v1/meta").expect(200);
    const parsed = MetaResponseSchema.safeParse(response.body);

    expect(parsed.success).toBe(true);
    expect(response.body.data.phase).toBe(6);
    expect(response.body.data.features.authentication).toBe(true);
    expect(response.body.data.features.database).toBe(true);
    expect(response.body.data.features.transactions).toBe(true);
    expect(response.body.data.features.budgets).toBe(true);
    expect(response.body.data.features.goals).toBe(true);
    expect(response.body.data.features.analytics).toBe(true);
    expect(response.body.data.features.rag).toBe(true);
  });
});

describe("GET /api/v1/ready", () => {
  it("reports the database as reachable", async () => {
    const response = await request(app).get("/api/v1/ready").expect(200);
    const parsed = HealthResponseSchema.safeParse(response.body);

    expect(parsed.success).toBe(true);
    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.checks.database).toBe("up");
  });
});

describe("service root", () => {
  it("advertises the versioned API", async () => {
    const response = await request(app).get("/").expect(200);
    expect(response.body.data.api).toBe("/api/v1");
    expect(response.body.data.health).toBe("/api/v1/health");
  });
});

describe("HTTP hardening", () => {
  it("sets baseline security headers", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["content-security-policy"]).toBeUndefined();
    expect(response.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });

  it("rejects JSON from an unknown origin with the standard envelope", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("origin", "https://evil.example")
      .expect(403);

    expect(response.body.error.code).toBe("CORS_NOT_ALLOWED");
    expect(response.body.error.requestId).toBeTruthy();
  });

  it("allows the configured development origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("origin", "http://localhost:5173")
      .expect(200);

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("error contract", () => {
  it("returns a structured 404", async () => {
    const response = await request(app).get("/api/v1/does-not-exist").expect(404);

    expect(response.body.error).toMatchObject({
      code: "NOT_FOUND",
      message: expect.stringContaining("/api/v1/does-not-exist"),
    });
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
  });

  it("returns a structured 400 for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/v1/health")
      .set("content-type", "application/json")
      .send('{"broken":')
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_JSON");
    expect(response.body.error.requestId).toBeTruthy();
  });
});
