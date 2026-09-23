import mongoose from 'mongoose';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { dollarsToMinor, MIN_PAYMENT_MINOR, MAX_PAYMENT_MINOR } from '../utils/money.js';

// CREATE PRICED ORDER AND RESERVE ITEMS (USER ONLY) + PAYMENT INTENT
export async function createPricedOrder(userId, items, reservationMinutes = 30) {
    return mongoose.connection.transaction(async session => {
        const pricedItems = [];
        let totalMinor = 0;

        // VALIDATE ITEMS, RESERVE STOCK, AND CALCULATE TOTAL
        for (const { product: productId, quantity } of items) {

            // VALIDATE PRODUCT AND STOCK
            const product = await Product.findById(productId).session(session);
            if (!product) {
                throw new NotFoundError(`Product ${productId} not found`);
            }
            if (!Number.isSafeInteger(product.stock) || product.stock < quantity) {
                throw new ConflictError(`Insufficient stock for ${product.name}`);
            }

            // VALIDATE PRICE AND CALCULATE TOTAL
            const priceMinor = dollarsToMinor(product.price);
            totalMinor += priceMinor * quantity;
            if (!Number.isSafeInteger(totalMinor) || totalMinor > MAX_PAYMENT_MINOR) {
                throw new ConflictError('Order exceeds the supported payment amount');
            }

            // RESERVE STOCK
            const reserved = await Product.updateOne(
                { _id: product._id, stock: { $gte: quantity } },
                { $inc: { stock: -quantity } },
                { session },
            );
            if (reserved.modifiedCount !== 1) {
                throw new ConflictError('Stock changed; please retry');
            }
            pricedItems.push({
                product: product._id,
                quantity,
                priceMinor,
                price: priceMinor / 100
            });
        }

        // VALIDATE MINIMUM ORDER AMOUNT
        if (totalMinor < MIN_PAYMENT_MINOR) {
            throw new ConflictError('Order must total at least $0.50');
        }

        // CREATE ORDER
        const [order] = await Order.create([{
            user: userId,
            items: pricedItems,
            totalMinor,
            total: totalMinor / 100,
            currency: 'usd',
            pricingVersion: 1,
            paymentStatus: 'pending',
            paymentIntentId: null,
            reservationExpiresAt: new Date(Date.now() + reservationMinutes * 60000),
        }], { session });

        return order;
    }, { readPreference: 'primary' });
}
