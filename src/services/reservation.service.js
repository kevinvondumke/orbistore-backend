import mongoose from 'mongoose';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { getTrustedAmount } from './payment.service.js';
import { applyPaymentEvent } from './webhook.service.js';

export async function cancelReservedOrder(orderId, userId, stripe) {
    const ownership = userId ? { $or: [{ userId }, { user: userId }] } : {};
    let order = await Order.findOne({ _id: orderId, ...ownership });
    if (!order) throw new NotFoundError('Order not found');
    if (order.paymentStatus === 'canceled') return order;
    if (order.paymentStatus === 'paid') throw new ConflictError('Paid orders cannot be canceled');
    if (order.pricingVersion !== 1) throw new ConflictError('Legacy order requires manual reconciliation');
    
    // An in-flight/ambiguous intent creation must be reconciled before release.
    const currency = (order.currency || 'usd').toLowerCase();
    if (order.paymentAttemptAt && !order.paymentIntentId) {
        if (Date.now() - order.paymentAttemptAt.getTime() > 23 * 3600000) {
            throw new ConflictError('Ambiguous payment requires operator reconciliation before releasing stock');
        }
        // Replay the identical idempotent request while Stripe still retains its key.
        // This also recovers a crash after Stripe created the intent but before linking it.
        const intent = await stripe.paymentIntents.create({
            amount: getTrustedAmount(order), 
            currency,
            metadata: { orderId: String(order._id) },
        }, { idempotencyKey: 'order:' + order._id + ':pricing:1' });
        if (intent.amount !== order.totalMinor || intent.currency.toLowerCase() !== currency) {
            throw new Error('Recovered payment mismatch');
        }

        const linked = await Order.findOneAndUpdate({
            _id: order._id, paymentStatus: { $in: ['pending', 'failed'] },
            $or: [{ paymentIntentId: null }, { paymentIntentId: intent.id }],
        }, { $set: { paymentIntentId: intent.id } }, { returnDocument: 'after' });
        if (!linked) throw new ConflictError('Order changed during payment recovery');
        order = linked;
    }

    // FIND THE ORDER AND MARK IT AS CANCELING
    order = await Order.findOneAndUpdate({
        _id: order._id, ...ownership,
        paymentStatus: { $in: ['pending', 'failed', 'canceling'] },
        $or: [{ paymentAttemptAt: null }, { paymentIntentId: { $type: 'string' } }],
    }, { $set: { paymentStatus: 'canceling' } }, { returnDocument: 'after' });
    if (!order) throw new ConflictError('Payment started while canceling; retry');
    if (order.paymentIntentId) {
        // RETRIEVE THE PAYMENT INTENT AND CHECK
        let intent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
        if (intent.status === 'succeeded') {
            await applyPaymentEvent({ type: 'payment_intent.succeeded', data: { object: intent } });
            throw new ConflictError('Payment already succeeded; order cannot be canceled');
        }
        if (intent.status !== 'canceled') {
            intent = await stripe.paymentIntents.cancel(intent.id);
        }
        if (intent.status !== 'canceled') {
            throw new ConflictError('Payment cannot be canceled yet');
        }
    }

    // RELEASE STOCK TRANSACTIONALLY (with standalone fallback for local dev)
    const releaseStock = async (session) => {
        const opts = session ? { session, returnDocument: 'after', runValidators: true } : { returnDocument: 'after', runValidators: true };
        const canceled = await Order.findOneAndUpdate({
            _id: order._id, paymentStatus: 'canceling', stockReleasedAt: null,
        }, { $set: { paymentStatus: 'canceled', stockReleasedAt: new Date() } }, opts);

        if (!canceled) {
            const current = session ? await Order.findById(order._id).session(session) : await Order.findById(order._id);
            if (current?.paymentStatus === 'canceled') return current;
            throw new ConflictError('Order changed during cancellation');
        }

        // Loop through canceled items and restore stock
        for (const item of canceled.items) {
            const prodId = item.productId || item.product;
            if (prodId) {
                const updateOpts = session ? { session } : {};
                await Product.updateOne(
                    { _id: prodId },
                    { $inc: { stock: item.quantity } },
                    updateOpts
                );
            }
        }

        return canceled;
    };

    try {
        return await mongoose.connection.transaction(releaseStock, { readPreference: 'primary' });
    } catch (err) {
        // Graceful fallback if MongoDB is not running in replica set mode
        if (err.message?.includes('replica set') || err.message?.includes('Transaction numbers')) {
            return await releaseStock(null);
        }
        throw err;
    }
}

// EXPIRE RESERVATIONS FOR ORDERS THAT HAVE NOT BEEN PAID IN TIME
export async function expireReservations(stripe) {
    // FIND ORDERS THAT ARE PENDING PAYMENT AND HAVE EXPIRED
    const orders = await Order.find({
        pricingVersion: 1,
        paymentStatus: { $in: ['pending', 'failed', 'canceling'] },
        reservationExpiresAt: { $lte: new Date() },
    }).sort({ reservationExpiresAt: 1 }).limit(100);

    // LOOP THROUGH THE ORDERS AND CANCEL THEIR RESERVATIONS
    for (const order of orders) {
        try {
            await cancelReservedOrder(order._id, null, stripe);
        } catch (error) {
            console.error('Reservation release deferred for order ' + order._id + ': ' + error.message);
        }
    }
}
