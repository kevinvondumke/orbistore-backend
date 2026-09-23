import { z } from 'zod';
import { dollarsToMinor } from '../utils/money.js';
const productSchema = z.strictObject({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(10000).optional(),
    price: z.number().refine(value => { try { dollarsToMinor(value); return true; } catch { return false; } },
        'Price must be nonnegative USD with at most two decimal places'),
    category: z.string().trim().max(100).optional(),
    stock: z.number().int().min(0).max(1_000_000),
    images: z.array(z.url().refine(url => /^https?:/.test(url), 'Use HTTP(S) URLs')).max(20),
});
export const createProductSchema = productSchema.extend({ stock: productSchema.shape.stock.default(0), images: productSchema.shape.images.default([]) });
export const updateProductSchema = productSchema.partial().refine(value => Object.keys(value).length > 0, 'Supply at least one field');
