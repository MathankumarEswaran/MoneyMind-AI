import type { CookieOptions, Request, Response } from "express";
import { env } from "../../config/env.js";

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.auth.cookie.secure,
    sameSite: env.auth.cookie.sameSite,
    path: env.auth.cookie.path,
    ...(env.auth.cookie.domain ? { domain: env.auth.cookie.domain } : {}),
  };
}

export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(env.auth.cookie.name, token, {
    ...baseCookieOptions(),
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(env.auth.cookie.name, baseCookieOptions());
}

export function readRefreshCookie(req: Request): string | null {
  const value: unknown = req.cookies?.[env.auth.cookie.name];
  return typeof value === "string" && value.length > 0 ? value : null;
}
