import express from 'express';
import { uploadImage } from '../controllers/upload.controller.js';
import { uploadSingleImage } from '../middlewares/upload.middleware.js';
import { authenticate, admin } from '../middlewares/auth.middleware.js';

const router = express.Router();

// UPLOAD IMAGE
router.post('/', authenticate, admin, uploadSingleImage, uploadImage);

export default router;