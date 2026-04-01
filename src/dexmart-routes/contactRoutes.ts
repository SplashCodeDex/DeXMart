import express from 'express';
import { ContactController } from '../controllers/contactController.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * POST /contacts/import
 * Import contacts from CSV
 */
router.post('/import', upload.single('file'), ContactController.importContacts);
router.post('/check-duplicates', ContactController.checkDuplicates);
router.get('/imports', ContactController.listImportHistory);
router.post('/imports/:id/undo', ContactController.undoImport);

/**
 * GET /contacts
 * List all contacts for a tenant
 */
router.get('/', ContactController.listContacts);

/**
 * POST /contacts
 * Create a new contact
 */
router.post('/', ContactController.createContact);

/**
 * PATCH /contacts/:id
 * Update a contact
 */
router.patch('/:id', ContactController.updateContact);

/**
 * DELETE /contacts/:id
 * Delete a contact
 */
router.delete('/:id', ContactController.deleteContact);

/**
 * GET /contacts/audiences
 * Get all audiences for a tenant
 */
router.get('/audiences', ContactController.getAudiences);

export default router;
