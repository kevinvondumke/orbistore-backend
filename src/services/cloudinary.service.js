import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApplicationError } from '../utils/errors.js';

// CONFIGURE CLOUDINARY ENV VARS
cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
});

// STREAM --> IN-MEM BUFFER --> CLOUDINARY
/** 
    * @param { Buffer } buffer - FILE BUFFER TO UPLOAD
    * @param { string } folder - CLOUDI FOLDER TO UPLOAD IMAGE TO
    * @returns { Promise<{ secure_url: string, public_id: string, width: number, height: number, format: string}> }
*/
export async function uploadImageBuffer(buffer, folder = 'orbistore/products') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            // OPTIONS
            {
                folder,
                resource_type: 'image',
                transformation: [
                    { quality: 'auto', fetch_format: 'auto' }
                ]
            },

            // CALLBACK
            (error, result) => {
                if (error || !result) {
                    logger.error('Cloudinary upload stream error: ', { error: error?.message || 'Unknown error' });
                    return reject(new ApplicationError('Failed to upload image to Cloudinary', 502));
                }

                resolve({
                    secure_url: result.secure_url,
                    public_id: result.public_id,
                    width: result.width,
                    height: result.height,
                    format: result.format
                });
            }
        );

        // CONVERT BUFFER TO N.JS READABLE STREAM + PIPE
        Readable.from(buffer).pipe(uploadStream);
    });
}

// DELETE AN IMAGE FROM CLOUDINARY --> BY PUBLIC ID
/**
    * @param { string } publicId - CLOUDINARY PUBLIC ID OF IMAGE --> TO DELETE
 */
export async function deleteImage(publicId) {
    if (!publicId) return;

    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        logger.error('Failed to delete image from Cloudinary: ', { publicId, error: error?.message || 'Unknown error' });
    }
}

export { cloudinary };