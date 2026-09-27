import multer from 'multer';
import { ApplicationError } from '../utils/errors.js';

// ALLOWED IMAGE MM TYPES
const IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
]);

// MULTER MEMORY STORAGE --> STORE FILES IN MEMORY AS BUFFER
const storage = multer.memoryStorage();

// MULTER UPLOAD CONFIGURATION
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1023, // 5MB
    },
    fileFilter: (_req, file, cb) => {
        if (IMAGE_MIME_TYPES.has(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new ApplicationError('Invalid file type. Only JPEG, PNG, WebP, and AVIF are allowed.', 400));
        }
    }
});

// SINGLE IMAGE UPLOAD MIDDLEWARE
export const uploadSingleImage = (req, res, next) => {
    upload.single('image')(req, res, (err) => {

        // LIMIT SIZE || FILE UPLOAD ERROR
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return next(new ApplicationError('File size exceeds 5MB limit.', 413));
            }
            return next(new ApplicationError(`Multer file upload error: ${err.message}`, 400));
        }
        if (err) {
            return next(err);
        }

        next();
    });
};