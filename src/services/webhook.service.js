import Order from '../models/order.model.js';
import { getTrustedAmount } from './payment.service.js';

// APPLY STRIPE PAYMENT EVENTS TO ORDER STATUS
export async function applyPaymentEvent(event) {
    if (!['payment_intent.succeeded', 'payment_intent.payment_failed'].includes(event.type)) return;
    const intent = event.data.object;

    // FIND THE ORDER BY PAYMENT INTENT ID OR METADATA REFERENCE
    let order = await Order.findOne({ paymentIntentId: intent.id });
    if (!order) {
        // A webhook can arrive before the intent reference is persisted.
        const orderId = intent.metadata?.orderId;
        if (!orderId) return; // Unrelated Stripe integration/event.
        if (!/^[a-fA-F0-9]{24}$/.test(orderId)) throw new Error('Invalid webhook order reference');
        order = await Order.findById(orderId);
        if (!order) throw new Error('Webhook order is not yet available');
        if (!order.paymentAttemptAt || (order.paymentIntentId && order.paymentIntentId !== intent.id)) {
            throw new Error('Webhook payment reference mismatch');
        }
    }

    // VERIFY PAYMENT AMOUNT AND CURRENCY MATCHES ORDER
    const amount = getTrustedAmount(order);
    const currency = (order.currency || 'usd').toLowerCase();
    const intentCurrency = (intent.currency || '').toLowerCase();

    if (intent.amount !== amount || intentCurrency !== currency ||
        (event.type === 'payment_intent.succeeded' && intent.amount_received !== amount)) {
        throw new Error('Webhook payment amount or currency mismatch');
    }
    if (order.paymentStatus === 'canceled') throw new Error('Payment event for canceled order requires reconciliation');

    // FILTER TO UPDATE ORDER WITH PAYMENT INTENT ID AND STATUS
    /** @type {import('mongoose').QueryFilter<import('mongoose').InferSchemaType<typeof Order.schema>>} */
    const filter = {
        _id: order._id, paymentStatus: { $in: ['pending', 'failed', 'canceling'] },
        $or: [{ paymentIntentId: null }, { paymentIntentId: intent.id }],
    };
    
    // UPDATE
    const updated = await Order.findOneAndUpdate(filter, { $set: {
        paymentIntentId: intent.id,
        paymentStatus: event.type === 'payment_intent.succeeded' ? 'paid' : 'failed',
    } }, { returnDocument: 'after', runValidators: true });
    if (!updated) {
        const current = await Order.findById(order._id);
        if (current?.paymentStatus !== 'paid' || current.paymentIntentId !== intent.id) {
            throw new Error('Webhook order changed; retry required');
        }
    }
}
