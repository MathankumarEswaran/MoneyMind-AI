import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import request from "supertest";
import type { Response } from "supertest";
import { AuthResponseSchema, MeResponseSchema, SessionsResponseSchema } from "@moneymind/shared";
import { createApp } from "../app.js";

const app = createApp();
const PASSWORD = "correct horse battery staple";

function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID()}@example.com`;
}

function refreshCookie(response: Response): string {
  const cookies = response.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = cookies?.find((value) => value.startsWith("mm_refresh="));

  if (!cookie) {
    throw new Error("Expected a refresh cookie on the response");
  }

  return cookie.split(";")[0]!;
}

async function registerUser(overrides: Record<string, unknown> = {}) {
  const payload = {
    name: "Ada Lovelace",
    email: uniqueEmail(),
    password: PASSWORD,
    workspaceName: "Lovelace Household",
    ...overrides,
  };

  const response = await request(app).post("/api/v1/auth/register").send(payload).expect(201);
  return { payload, response };
}

describe("POST /api/v1/auth/register", () => {
  it("creates an account, a personal workspace and a session", async () => {
    const { payload, response } = await registerUser();
    const parsed = AuthResponseSchema.safeParse(response.body);

    expect(parsed.success).toBe(true);
    expect(response.body.data.user.email).toBe(payload.email);
    expect(response.body.data.user.name).toBe(payload.name);
    expect(response.body.data.user.emailVerified).toBe(false);
    expect(response.body.data.user.workspace.name).toBe(payload.workspaceName);
    expect(response.body.data.user.workspace.role).toBe("OWNER");
    expect(response.body.data.accessToken.split(".")).toHaveLength(3);

    const cookie = refreshCookie(response);
    expect(cookie).toMatch(/^mm_refresh=[A-Za-z0-9_-]{40,}$/);
    const rawCookie = (response.headers["set-cookie"] as unknown as string[])[0]!;
    expect(rawCookie).toContain("HttpOnly");
    expect(rawCookie).toContain("Path=/api/v1/auth");
    expect(rawCookie).toContain("SameSite=Strict");

    // The password must never come back, even hashed.
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    expect(JSON.stringify(response.body)).not.toContain("argon2");
  });

  it("normalizes the email to lowercase and rejects duplicates", async () => {
    const email = uniqueEmail("case");
    await registerUser({ email: `  ${email.toUpperCase()} ` });

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Ada Again", email, password: PASSWORD })
      .expect(409);

    expect(response.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("derives a workspace name when none is supplied", async () => {
    const { response } = await registerUser({ name: "Grace Hopper", workspaceName: undefined });
    expect(response.body.data.user.workspace.name).toBe("Grace's workspace");
  });

  it("rejects invalid payloads with field-level details", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "A", email: "not-an-email", password: "short" })
      .expect(422);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.fields).toMatchObject({
      name: expect.any(Array),
      email: expect.any(Array),
      password: expect.any(Array),
    });
  });

  it("rejects unexpected fields instead of ignoring them", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({ name: "Ada Lovelace", email: uniqueEmail(), password: PASSWORD, role: "ADMIN" })
      .expect(422);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/login", () => {
  it("issues a session for valid credentials", async () => {
    const { payload } = await registerUser();

    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: payload.email.toUpperCase(), password: PASSWORD })
      .expect(200);

    expect(AuthResponseSchema.safeParse(response.body).success).toBe(true);
    expect(response.body.data.user.email).toBe(payload.email);
    refreshCookie(response);
  });

  it("returns the same error for a wrong password and an unknown account", async () => {
    const { payload } = await registerUser();

    const wrongPassword = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: payload.email, password: "definitely-not-it" })
      .expect(401);

    const unknownAccount = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: uniqueEmail("nobody"), password: PASSWORD })
      .expect(401);

    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unknownAccount.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unknownAccount.body.error.message).toBe(wrongPassword.body.error.message);
  });
});

describe("protected routes", () => {
  it("rejects requests without an access token", async () => {
    const response = await request(app).get("/api/v1/auth/me").expect(401);
    expect(response.body.error.code).toBe("AUTH_REQUIRED");
  });

  it("rejects malformed and tampered tokens", async () => {
    await request(app).get("/api/v1/auth/me").set("authorization", "Basic abc").expect(401);

    const { response } = await registerUser();
    const token = response.body.data.accessToken as string;
    const tampered = `${token.slice(0, -2)}aa`;

    const tamperedResponse = await request(app)
      .get("/api/v1/auth/me")
      .set("authorization", `Bearer ${tampered}`)
      .expect(401);

    expect(tamperedResponse.body.error.code).toBe("ACCESS_TOKEN_INVALID");
  });

  it("returns the authenticated user and current session", async () => {
    const { response: registration } = await registerUser();
    const token = registration.body.data.accessToken as string;

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    const parsed = MeResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    expect(response.body.data.session.current).toBe(true);
    expect(response.body.data.user.workspace.role).toBe("OWNER");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("rotates the refresh token", async () => {
    const { response: registration } = await registerUser();
    const firstCookie = refreshCookie(registration);

    const firstRefresh = await request(app)
      .post("/api/v1/auth/refresh")
      .set("cookie", firstCookie)
      .expect(200);

    const secondCookie = refreshCookie(firstRefresh);
    expect(secondCookie).not.toBe(firstCookie);
    expect(firstRefresh.body.data.accessToken).not.toBe(registration.body.data.accessToken);

    await request(app).post("/api/v1/auth/refresh").set("cookie", secondCookie).expect(200);
  });

  it("revokes every session when a rotated token is replayed", async () => {
    const { response: registration } = await registerUser();
    const firstCookie = refreshCookie(registration);

    const rotated = await request(app)
      .post("/api/v1/auth/refresh")
      .set("cookie", firstCookie)
      .expect(200);
    const secondCookie = refreshCookie(rotated);

    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("cookie", firstCookie)
      .expect(401);

    expect(replay.body.error.code).toBe("SESSION_REVOKED");

    // Reuse detection must be fail-closed: the rotated token is dead too.
    await request(app).post("/api/v1/auth/refresh").set("cookie", secondCookie).expect(401);
  });

  it("rejects a missing cookie", async () => {
    const response = await request(app).post("/api/v1/auth/refresh").expect(401);
    expect(response.body.error.code).toBe("NO_SESSION");
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("revokes the session and clears the cookie", async () => {
    const { response: registration } = await registerUser();
    const cookie = refreshCookie(registration);

    const logout = await request(app).post("/api/v1/auth/logout").set("cookie", cookie).expect(200);

    expect(logout.body.data.message).toContain("signed out");
    expect(String(logout.headers["set-cookie"])).toContain("mm_refresh=;");

    await request(app).post("/api/v1/auth/refresh").set("cookie", cookie).expect(401);
  });

  it("is idempotent without a session", async () => {
    await request(app).post("/api/v1/auth/logout").expect(200);
  });
});

describe("profile and sessions", () => {
  it("updates the profile", async () => {
    const { response: registration } = await registerUser();
    const token = registration.body.data.accessToken as string;

    const response = await request(app)
      .patch("/api/v1/auth/me")
      .set("authorization", `Bearer ${token}`)
      .send({ name: "Ada Byron", timezone: "Europe/London", locale: "en-GB" })
      .expect(200);

    expect(response.body.data.user.name).toBe("Ada Byron");
    expect(response.body.data.user.timezone).toBe("Europe/London");
    expect(response.body.data.user.locale).toBe("en-GB");
  });

  it("rejects an empty profile update and an invalid time zone", async () => {
    const { response: registration } = await registerUser();
    const token = registration.body.data.accessToken as string;

    await request(app)
      .patch("/api/v1/auth/me")
      .set("authorization", `Bearer ${token}`)
      .send({})
      .expect(422);

    await request(app)
      .patch("/api/v1/auth/me")
      .set("authorization", `Bearer ${token}`)
      .send({ timezone: "Mars/Olympus" })
      .expect(422);
  });

  it("lists sessions and revokes another device's session", async () => {
    const { payload, response: registration } = await registerUser();
    const firstToken = registration.body.data.accessToken as string;

    const secondLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: payload.email, password: PASSWORD })
      .expect(200);
    const secondToken = secondLogin.body.data.accessToken as string;

    const list = await request(app)
      .get("/api/v1/auth/sessions")
      .set("authorization", `Bearer ${secondToken}`)
      .expect(200);

    expect(SessionsResponseSchema.safeParse(list.body).success).toBe(true);
    const sessions = list.body.data.sessions as Array<{ id: string; current: boolean }>;
    expect(sessions).toHaveLength(2);
    expect(sessions.filter((session) => session.current)).toHaveLength(1);

    const other = sessions.find((session) => !session.current)!;

    await request(app)
      .delete(`/api/v1/auth/sessions/${other.id}`)
      .set("authorization", `Bearer ${secondToken}`)
      .expect(200);

    // The revoked access token keeps working briefly by design (15 min TTL),
    // but its session is gone, so /auth/me must reject it immediately.
    const rejected = await request(app)
      .get("/api/v1/auth/me")
      .set("authorization", `Bearer ${firstToken}`)
      .expect(401);

    expect(rejected.body.error.code).toBe("SESSION_REVOKED");

    const remaining = await request(app)
      .get("/api/v1/auth/sessions")
      .set("authorization", `Bearer ${secondToken}`)
      .expect(200);

    expect(remaining.body.data.sessions).toHaveLength(1);
  });

  it("rejects revoking a session that belongs to someone else", async () => {
    const { response: first } = await registerUser();
    const { response: second } = await registerUser();

    const secondSessions = await request(app)
      .get("/api/v1/auth/sessions")
      .set("authorization", `Bearer ${second.body.data.accessToken}`)
      .expect(200);

    const foreignSessionId = secondSessions.body.data.sessions[0].id as string;

    const response = await request(app)
      .delete(`/api/v1/auth/sessions/${foreignSessionId}`)
      .set("authorization", `Bearer ${first.body.data.accessToken}`)
      .expect(404);

    expect(response.body.error.code).toBe("SESSION_NOT_FOUND");

    // The owner's session is untouched.
    await request(app)
      .get("/api/v1/auth/me")
      .set("authorization", `Bearer ${second.body.data.accessToken}`)
      .expect(200);
  });

  it("logs out every session at once", async () => {
    const { payload, response: registration } = await registerUser();
    const token = registration.body.data.accessToken as string;

    const secondLogin = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: payload.email, password: PASSWORD })
      .expect(200);
    const secondCookie = refreshCookie(secondLogin);

    const response = await request(app)
      .post("/api/v1/auth/logout-all")
      .set("authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.data.message).toContain("All sessions");

    await request(app).post("/api/v1/auth/refresh").set("cookie", secondCookie).expect(401);
    await request(app).get("/api/v1/auth/me").set("authorization", `Bearer ${token}`).expect(401);
  });
});
