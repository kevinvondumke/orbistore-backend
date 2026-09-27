import { uploadImageBuffer } from '../services/cloudinary.service.js';
import { ApplicationError } from '../utils/errors.js';

// UPLOAD SINGLE IMAGE TO CLOUDINARY
/**
 * @type { import('express').RequestHandler }
 */
export const uploadImage = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new ApplicationError('No file uploaded.', 400);
        }

        // GET FOLDER NAME
        const folder = typeof req.body?.folder === 'string' && req.body.folder.trim() ? req.body.folder.trim() : 'orbistore/products';

        // UPLOAD IMAGE TO CLOUDINARY
        const result = await uploadImageBuffer(req.file.buffer, folder);

        return res.status(201).json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};