import { z } from "zod";
import { CurrencySchema } from "./common.js";

/** Roles are workspace-scoped. A user can hold different roles in different workspaces. */
export const WorkspaceRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;

export const UserProfileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1).max(80),
  avatarUrl: z.url().nullable(),
  timezone: z.string().min(1).max(64),
  locale: z.string().min(2).max(16),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const WorkspaceSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(80),
  baseCurrency: CurrencySchema,
  role: WorkspaceRoleSchema,
  createdAt: z.iso.datetime(),
});

export type WorkspaceSummary = z.infer<typeof WorkspaceSummarySchema>;

export const SessionSummarySchema = z.object({
  id: z.uuid(),
  userAgent: z.string().nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  current: z.boolean(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const AuthenticatedUserSchema = UserProfileSchema.extend({
  workspace: WorkspaceSummarySchema,
});

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;

// ── Request contracts ────────────────────────────────────────────────────────

/**
 * Emails are normalized once, at the edge, so uniqueness checks and lookups
 * never depend on how the user happened to capitalize their address.
 */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));

export const PasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128, "Use 128 characters or fewer");

export const RegisterInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters")
      .max(80, "Use 80 characters or fewer"),
    email: EmailSchema,
    password: PasswordSchema,
    workspaceName: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters")
      .max(80, "Use 80 characters or fewer")
      .optional(),
  })
  .strict();

export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const LoginInputSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1, "Enter your password").max(128),
  })
  .strict();

export type LoginInput = z.infer<typeof LoginInputSchema>;

const TimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid time zone");

export const UpdateProfileInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters")
      .max(80, "Use 80 characters or fewer")
      .optional(),
    timezone: TimezoneSchema.optional(),
    locale: z
      .string()
      .trim()
      .min(2)
      .max(16)
      .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/, "Choose a valid locale")
      .optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

// ── Response contracts ───────────────────────────────────────────────────────

export const AuthSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime(),
  user: AuthenticatedUserSchema,
});

export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const AuthResponseSchema = z.object({
  data: AuthSessionSchema,
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const MeResponseSchema = z.object({
  data: z.object({
    user: AuthenticatedUserSchema,
    session: SessionSummarySchema,
  }),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

export const UpdateProfileResponseSchema = z.object({
  data: z.object({
    user: AuthenticatedUserSchema,
  }),
});

export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;

export const SessionsResponseSchema = z.object({
  data: z.object({
    sessions: z.array(SessionSummarySchema),
  }),
});

export type SessionsResponse = z.infer<typeof SessionsResponseSchema>;

export const SessionResponseSchema = z.object({
  data: z.object({
    session: SessionSummarySchema,
  }),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const MessageResponseSchema = z.object({
  data: z.object({
    message: z.string(),
  }),
});

export type MessageResponse = z.infer<typeof MessageResponseSchema>;
