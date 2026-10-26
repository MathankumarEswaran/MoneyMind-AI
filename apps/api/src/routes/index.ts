import { Router } from "express";
import { aiRouter } from "../modules/ai/ai.routes.js";
import { authRouter } from "../modules/auth/auth.routes.js";
import { documentsRouter } from "../modules/documents/documents.routes.js";
import { financeRouter } from "../modules/finance/finance.routes.js";
import { ragRouter } from "../modules/rag/rag.routes.js";
import { healthRouter } from "./health.routes.js";

/**
 * Versioned API surface. Modules mount here behind their own routers.
 */
export const apiRouter: Router = Router();

apiRouter.use(healthRouter);
apiRouter.use(authRouter);
apiRouter.use(financeRouter);
apiRouter.use(aiRouter);
apiRouter.use(documentsRouter);
apiRouter.use(ragRouter);
