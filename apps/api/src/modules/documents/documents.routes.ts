import { Router, type Request, type Response } from "express";
import multer from "multer";
import { env } from "../../config/env.js";
import { sendError, sendSuccess } from "../../lib/api-response.js";
import { requireActiveSession, requireAuth } from "../../middleware/authenticate.js";
import { loadDocumentContext } from "./documents.context.js";
import { deleteDocument, getDocument, listDocuments, uploadDocument } from "./documents.service.js";

export const documentsRouter: Router = Router();

documentsRouter.use("/documents", requireAuth, requireActiveSession);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.upload.maxBytes },
  fileFilter: (_req, file, cb) => {
    if (env.upload.allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("UNSUPPORTED_MIME"));
    }
  },
});

documentsRouter.get("/documents", async (req: Request, res: Response) => {
  const ctx = await loadDocumentContext(req);
  const result = await listDocuments(ctx);
  sendSuccess(res, result);
});

documentsRouter.get("/documents/:id", async (req: Request, res: Response) => {
  const ctx = await loadDocumentContext(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await getDocument(ctx, id);
  sendSuccess(res, result);
});

documentsRouter.post("/documents/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const ctx = await loadDocumentContext(req);
    const result = await uploadDocument(ctx, req);
    sendSuccess(res, result);
  } catch (error) {
    if ((error as Error).message === "UNSUPPORTED_MIME") {
      sendError(res, 400, "UNSUPPORTED_MIME", "File type not allowed.", req.id);
      return;
    }
    throw error;
  }
});

documentsRouter.delete("/documents/:id", async (req: Request, res: Response) => {
  const ctx = await loadDocumentContext(req);
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await deleteDocument(ctx, id);
  sendSuccess(res, { deleted: true });
});
