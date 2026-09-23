import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import Order from '../src/models/order.model.js';
import { stripe } from '../src/services/stripe.service.js';
import { getTrustedAmount } from '../src/services/payment.service.js';
import { applyPaymentEvent } from '../src/services/webhook.service.js';

// Explicit operator recovery for attempts older than Stripe's idempotency window.
// Never creates a new Stripe intent. Operator supplies the existing intent ID.
const [orderId, intentId, apply] = process.argv.slice(2);
try {
    if (!/^[a-fA-F0-9]{24}$/.test(orderId || '') || !/^pi_/.test(intentId || '')) throw new Error('Usage: node scripts/reconcile-payment.js ORDER_ID pi_INTENT [--apply]');
    await mongoose.connect(env.DATABASE_URL, { autoIndex: false });
    const order = await Order.findById(orderId);
    if (!order || order.paymentStatus === 'canceled') throw new Error('Order unavailable');
    const intent = await stripe.paymentIntents.retrieve(intentId);
    if (intent.metadata.orderId !== orderId || intent.amount !== getTrustedAmount(order) || intent.currency !== order.currency) {
        throw new Error('Stripe intent does not match this order');
    }
    if (order.paymentIntentId && order.paymentIntentId !== intent.id) throw new Error('Order already references another payment');
    if (apply === '--apply') {
        const linked = await Order.findOneAndUpdate({
            _id: order._id, paymentStatus: { $ne: 'canceled' },
            $or: [{ paymentIntentId: null }, { paymentIntentId: intent.id }],
        }, { $set: { paymentIntentId: intent.id } }, { returnDocument: 'after' });
        if (!linked) throw new Error('Order changed; reconciliation stopped');
        if (intent.status === 'succeeded') await applyPaymentEvent({ type: 'payment_intent.succeeded', data: { object: intent } });
        console.log('Existing payment reconciled. No new payment was created.');
    } else console.log('Matching intent verified. Re-run with --apply to link it.');
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
