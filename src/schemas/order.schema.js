import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid product or order ID').toLowerCase();

// Unknown fields (including client prices/totals) are stripped.
export const createOrderSchema = z.object({
    items: z.array(z.object({
        product: objectIdSchema,
        quantity: z.number().int().min(1).max(1000),
    })).min(1).max(100),
}).superRefine(({ items }, context) => {
    const seen = new Set();
    items.forEach((item, index) => {
        if (seen.has(item.product)) {
            context.addIssue({ code: 'custom', path: ['items', index, 'product'], message: 'Duplicate product; combine quantities into one item' });
        }
        seen.add(item.product);
    });
});

export const createPaymentSchema = z.object({ orderId: objectIdSchema });
export const updateOrderStatusSchema = z.strictObject({ fulfillmentStatus: z.enum(['processing', 'shipped', 'delivered']) });
