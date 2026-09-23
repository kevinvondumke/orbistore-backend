import { z } from 'zod';
import { objectIdSchema } from './order.schema.js';

// ID PARAMS SCHEMA
export const idParamsSchema = z.object({ id: objectIdSchema });

// PAGINATION QUERY SCHEMA
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
