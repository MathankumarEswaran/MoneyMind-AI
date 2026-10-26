import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/app-error.js";
import { sendError } from "../lib/api-response.js";
import { env } from "../config/env.js";

interface BodyParserError extends SyntaxError {
  status?: number;
  type?: string;
}

export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, "NOT_FOUND", `No route matches ${req.method} ${req.originalUrl}.`, req.id);
}

/**
 * Single error boundary: every failure leaves the API in the same envelope.
 * Stack traces are logged, never returned in production.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) return;

  let statusCode = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred.";
  let details: unknown;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.expose ? error.message : message;
    details = error.expose ? error.details : undefined;
  } else if (error instanceof SyntaxError) {
    const bodyError = error as BodyParserError;
    if (bodyError.status === 400 && bodyError.type === "entity.parse.failed") {
      statusCode = 400;
      code = "INVALID_JSON";
      message = "The request body contains invalid JSON.";
    }
  }

  if (statusCode >= 500) {
    req.log.error({ err: error, requestId: req.id }, "Unhandled request error");
  } else {
    req.log.warn({ err: error, requestId: req.id, statusCode, code }, "Request rejected");
  }

  if (!env.isProd) {
    req.log.debug({ requestId: req.id }, "Error response sent");
  }

  sendError(res, statusCode, code, message, req.id, details);
}
