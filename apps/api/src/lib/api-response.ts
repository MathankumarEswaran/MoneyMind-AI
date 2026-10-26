import type { Response } from "express";
import type { ApiErrorPayload, ApiSuccess } from "@moneymind/shared";

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; meta?: Record<string, unknown> } = {},
): Response {
  const body: ApiSuccess<T> = options.meta ? { data, meta: options.meta } : { data };
  return res.status(options.status ?? 200).json(body);
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  requestId?: string,
  details?: unknown,
): Response {
  const body: ApiErrorPayload = {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };

  return res.status(status).json(body);
}
