import { describe, expect, it } from "vitest";
import {
  EmailSchema,
  LoginInputSchema,
  RegisterInputSchema,
  UpdateProfileInputSchema,
} from "./auth.js";

describe("EmailSchema", () => {
  it("trims and lowercases addresses", () => {
    expect(EmailSchema.parse("  Ada@Example.COM ")).toBe("ada@example.com");
  });

  it("rejects malformed addresses", () => {
    expect(EmailSchema.safeParse("not-an-email").success).toBe(false);
    expect(EmailSchema.safeParse("a@b").success).toBe(false);
  });
});

describe("RegisterInputSchema", () => {
  const valid = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    password: "correct horse battery staple",
    workspaceName: "Lovelace Household",
  };

  it("accepts a strong registration payload", () => {
    expect(RegisterInputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects short passwords", () => {
    const result = RegisterInputSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields instead of silently dropping them", () => {
    const result = RegisterInputSchema.safeParse({ ...valid, role: "OWNER" });
    expect(result.success).toBe(false);
  });

  it("makes the workspace name optional", () => {
    const { workspaceName: _workspaceName, ...withoutWorkspace } = valid;
    expect(RegisterInputSchema.safeParse(withoutWorkspace).success).toBe(true);
  });
});

describe("LoginInputSchema", () => {
  it("does not impose password composition rules at login", () => {
    expect(LoginInputSchema.safeParse({ email: "ada@example.com", password: "x" }).success).toBe(
      true,
    );
  });

  it("requires a valid email", () => {
    expect(LoginInputSchema.safeParse({ email: "ada", password: "x" }).success).toBe(false);
  });
});

describe("UpdateProfileInputSchema", () => {
  it("accepts a valid IANA time zone", () => {
    expect(UpdateProfileInputSchema.safeParse({ timezone: "Europe/London" }).success).toBe(true);
  });

  it("rejects an unknown time zone", () => {
    expect(UpdateProfileInputSchema.safeParse({ timezone: "Mars/Olympus" }).success).toBe(false);
  });

  it("requires at least one field", () => {
    expect(UpdateProfileInputSchema.safeParse({}).success).toBe(false);
  });
});
