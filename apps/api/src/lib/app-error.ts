/**
 * Application-level error with a stable machine-readable code.
 * Messages are safe to return to clients unless `expose` is false.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    options: { details?: unknown; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }

  static notFound(message = "The requested resource does not exist."): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, "BAD_REQUEST", message, { details });
  }

  static unauthorized(message = "Authentication is required."): AppError {
    return new AppError(401, "UNAUTHORIZED", message);
  }

  static forbidden(message = "You do not have access to this resource."): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError(409, "CONFLICT", message, { details });
  }

  static tooManyRequests(message = "Too many requests. Try again shortly."): AppError {
    return new AppError(429, "RATE_LIMITED", message);
  }
}
