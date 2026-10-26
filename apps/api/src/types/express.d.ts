/**
 * Express request augmentation. This file is a module (the `export {}` below)
 * so the declaration merges with Express instead of shadowing its package.
 */
export {};

declare module "express-serve-static-core" {
  interface Request {
    /** Correlation ID assigned by the request-id middleware. */
    id: string;

    /** Populated by requireAuth after a valid access token is verified. */
    auth?: {
      userId: string;
      sessionId: string;
      accessTokenExpiresAt: Date;
    };
  }
}
