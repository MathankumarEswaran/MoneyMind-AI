import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../lib/app-error.js";

function validationError(error: z.ZodError): AppError {
  const flattened = z.flattenError(error);

  return new AppError(422, "VALIDATION_ERROR", "Some fields need your attention.", {
    details: {
      fields: flattened.fieldErrors,
      form: flattened.formErrors,
    },
  });
}

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    req.body = result.data;
    next();
  };
}

export function validateParams<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    req.params = result.data as Request["params"];
    next();
  };
}

/**
 * Express 5 exposes `req.query` as a read-only getter, so parsed query data is
 * kept off the request object. A WeakMap keeps the typed value local to the
 * request and disappears with it.
 */
const validatedQueries = new WeakMap<Request, unknown>();

export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      next(validationError(result.error));
      return;
    }

    validatedQueries.set(req, result.data);
    next();
  };
}

export function getValidatedQuery<T>(req: Request): T {
  const value = validatedQueries.get(req);

  if (value === undefined) {
    throw new Error("getValidatedQuery called without validateQuery on this route");
  }

  return value as T;
}
