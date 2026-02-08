import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../middleware/auth';
import { db } from '../db';
import { documents } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { uploadFile, getSignedUrl, deleteFile } from '../lib/storage';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';

const router = Router();

// Multer configuration — 10 MB max, common document types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Supported: PDF, JPEG, PNG, WebP, DOC, DOCX, XLS, XLSX'));
    }
  },
});

// POST /api/documents/upload — upload a document
router.post(
  '/upload',
  authenticate,
  requirePermission('employees:read'),
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: 'No file provided', code: 'NO_FILE', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      const { entityType, entityId } = req.body;
      if (!entityType || !entityId) {
        res.status(400).json({ success: false, error: 'entityType and entityId are required', code: 'VALIDATION_ERROR', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      // Generate unique file path
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const destination = `${entityType}/${entityId}/${timestamp}-${sanitizedName}`;

      const fileUrl = await uploadFile(file.buffer, destination, file.mimetype);

      const [doc] = await db
        .insert(documents)
        .values({
          entityType,
          entityId: Number(entityId),
          fileName: file.originalname,
          fileUrl,
          fileType: file.mimetype,
          fileSize: file.size,
          uploadedBy: req.user!.id,
        })
        .returning();

      createAuditLog({
        userId: req.user!.id,
        action: 'document_uploaded',
        entityType,
        entityId: Number(entityId),
        changes: { fileName: file.originalname, fileSize: file.size },
      });

      res.status(201).json({ success: true, data: doc, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to upload document', { error });
      const message = error instanceof Error ? error.message : 'Failed to upload document';
      res.status(500).json({ success: false, error: message, code: 'UPLOAD_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// GET /api/documents/:entityType/:entityId — list documents for an entity
router.get(
  '/:entityType/:entityId',
  authenticate,
  requirePermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;

      const docs = await db
        .select()
        .from(documents)
        .where(and(eq(documents.entityType, entityType as string), eq(documents.entityId, Number(entityId as string))))
        .orderBy(documents.createdAt);

      res.json({ success: true, data: docs, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to fetch documents', { error });
      res.status(500).json({ success: false, error: 'Failed to fetch documents', code: 'DOCS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// GET /api/documents/:id/download — get signed URL for download
router.get(
  '/:id/download',
  authenticate,
  requirePermission('employees:read'),
  async (req: Request, res: Response) => {
    try {
      const docId = Number(req.params.id as string);
      const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);

      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      const signedUrl = await getSignedUrl(doc.fileUrl);

      res.json({ success: true, data: { url: signedUrl, fileName: doc.fileName }, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to generate download URL', { error });
      res.status(500).json({ success: false, error: 'Failed to generate download URL', code: 'DOWNLOAD_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

// DELETE /api/documents/:id — delete a document
router.delete(
  '/:id',
  authenticate,
  requirePermission('employees:delete'),
  async (req: Request, res: Response) => {
    try {
      const docId = Number(req.params.id as string);
      const [doc] = await db.select().from(documents).where(eq(documents.id, docId)).limit(1);

      if (!doc) {
        res.status(404).json({ success: false, error: 'Document not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }

      await deleteFile(doc.fileUrl);
      await db.delete(documents).where(eq(documents.id, docId));

      createAuditLog({
        userId: req.user!.id,
        action: 'document_deleted',
        entityType: doc.entityType,
        entityId: doc.entityId,
        changes: { fileName: doc.fileName },
      });

      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Failed to delete document', { error });
      res.status(500).json({ success: false, error: 'Failed to delete document', code: 'DELETE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
    }
  },
);

export default router;
