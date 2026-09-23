import '../test/setup.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import User from '../src/models/user.model.js';
import Product from '../src/models/product.model.js';
import Order from '../src/models/order.model.js';
import { createPricedOrder } from '../src/services/order.service.js';
import { createOrderPayment } from '../src/services/payment.service.js';
import { applyPaymentEvent } from '../src/services/webhook.service.js';
import { cancelReservedOrder, expireReservations } from '../src/services/reservation.service.js';
import { MongoRateLimitStore } from '../src/services/rate-limit.store.js';
import connectDB, { verifyUserEmails } from '../src/config/db.js';
import { env } from '../src/config/env.js';

test('disposable MongoDB replica-set integration', { skip: process.env.RUN_DB_TESTS !== '1', timeout: 180000 }, async t => {
    const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6' } });
    t.after(async () => { await mongoose.disconnect(); await replica.stop(); });
    env.DATABASE_URL = replica.getUri('orbistore_integration');
    await connectDB();
    const user = new mongoose.Types.ObjectId();
    const inventory = async (stock = 5) => Product.create({ name: 'Integration product', price: 19.99, stock });
    const paymentStub = () => {
        const intents = new Map();
        let calls = 0;
        return {
            get calls() { return calls; },
            paymentIntents: {
                async create(params, options) {
                    calls++;
                    if (!intents.has(options.idempotencyKey)) intents.set(options.idempotencyKey, {
                        ...params, id: 'pi_' + String(params.metadata.orderId),
                        status: 'requires_payment_method', client_secret: 'test-only',
                    });
                    return { ...intents.get(options.idempotencyKey) };
                },
                async retrieve(id) { return { ...[...intents.values()].find(intent => intent.id === id) }; },
                async cancel(id) {
                    const intent = [...intents.values()].find(item => item.id === id);
                    intent.status = 'canceled';
                    return { ...intent };
                },
            },
        };
    };
    await t.test('stock deductions roll back when a later product is missing', async () => {
        const product = await inventory();
        await assert.rejects(createPricedOrder(user, [
            { product: String(product._id), quantity: 2 },
            { product: String(new mongoose.Types.ObjectId()), quantity: 1 },
        ]), { statusCode: 404 });
        assert.equal((await Product.findById(product._id)).stock, 5);
    });
    await t.test('concurrent orders cannot oversell the final unit', async () => {
        const product = await inventory(1);
        const results = await Promise.allSettled([1, 2].map(() => createPricedOrder(user, [{ product: String(product._id), quantity: 1 }])));
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal((await Product.findById(product._id)).stock, 0);
    });
    await t.test('unique email index rejects concurrent duplicate users', async () => {
        const results = await Promise.allSettled([1, 2].map(() => User.create({ name: 'Test', email: 'same@example.com', password: 'hashed' })));
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.find(result => result.status === 'rejected').reason.code, 11000);
        await verifyUserEmails();
    });
    await t.test('concurrent checkout keeps one intent and webhooks cannot downgrade paid', async () => {
        const product = await inventory();
        const order = await createPricedOrder(user, [{ product: String(product._id), quantity: 2 }]);
        const stripe = paymentStub();
        const payments = await Promise.all([1, 2].map(() => createOrderPayment(order._id, user, stripe)));
        assert.equal(payments[0].paymentIntentId, payments[1].paymentIntentId);
        const intent = await stripe.paymentIntents.retrieve(payments[0].paymentIntentId);
        const success = { type: 'payment_intent.succeeded', data: { object: { ...intent, amount_received: intent.amount } } };
        await applyPaymentEvent(success);
        await applyPaymentEvent(success);
        await applyPaymentEvent({ type: 'payment_intent.payment_failed', data: { object: intent } });
        assert.equal((await Order.findById(order._id)).paymentStatus, 'paid');
        await assert.rejects(cancelReservedOrder(order._id, user, stripe), { statusCode: 409 });
        assert.equal((await Product.findById(product._id)).stock, 3);
    });
    await t.test('mismatched webhook amounts never mark an order paid', async () => {
        const product = await inventory();
        const order = await createPricedOrder(user, [{ product: String(product._id), quantity: 1 }]);
        const stripe = paymentStub();
        const payment = await createOrderPayment(order._id, user, stripe);
        const intent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
        await assert.rejects(applyPaymentEvent({ type: 'payment_intent.succeeded', data: { object: { ...intent, amount_received: 1 } } }));
        assert.equal((await Order.findById(order._id)).paymentStatus, 'pending');
    });
    await t.test('concurrent cancellations cancel Stripe and restock exactly once', async () => {
        const product = await inventory();
        const order = await createPricedOrder(user, [{ product: String(product._id), quantity: 2 }]);
        const stripe = paymentStub();
        const payment = await createOrderPayment(order._id, user, stripe);
        await Promise.all([1, 2].map(() => cancelReservedOrder(order._id, user, stripe)));
        assert.equal((await Product.findById(product._id)).stock, 5);
        assert.equal((await stripe.paymentIntents.retrieve(payment.paymentIntentId)).status, 'canceled');
        assert.equal((await Order.findById(order._id)).paymentStatus, 'canceled');
    });
    await t.test('expired unpaid reservations are released', async () => {
        const product = await inventory();
        const order = await createPricedOrder(user, [{ product: String(product._id), quantity: 1 }]);
        await Order.updateOne({ _id: order._id }, { $set: { reservationExpiresAt: new Date(0) } });
        await expireReservations(paymentStub());
        assert.equal((await Product.findById(product._id)).stock, 5);
    });
    await t.test('shared rate-limit stores count simultaneous requests atomically', async () => {
        const first = new MongoRateLimitStore('integration:');
        const second = new MongoRateLimitStore('integration:');
        const results = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).increment('client')));
        assert.equal(Math.max(...results.map(value => value.totalHits)), 20);
        await first.resetKey('client');
        assert.equal((await second.increment('client')).totalHits, 1);
    });
    await t.test('a failed database update is retried successfully on webhook redelivery', async child => {
        const product = await inventory();
        const order = await createPricedOrder(user, [{ product: String(product._id), quantity: 1 }]);
        const stripe = paymentStub();
        const payment = await createOrderPayment(order._id, user, stripe);
        const intent = await stripe.paymentIntents.retrieve(payment.paymentIntentId);
        const event = { type: 'payment_intent.succeeded', data: { object: { ...intent, amount_received: intent.amount } } };
        const update = child.mock.method(Order, 'findOneAndUpdate', async () => { throw new Error('Transient DB outage'); });
        await assert.rejects(applyPaymentEvent(event), /Transient DB outage/);
        update.mock.restore();
        await applyPaymentEvent(event);
        assert.equal((await Order.findById(order._id)).paymentStatus, 'paid');
    });
    await t.test('cancellation recovers an ambiguous recent Stripe creation before releasing stock', async () => {
        const product = await inventory();
        const order = await createPricedOrder(user, [{ product: String(product._id), quantity: 1 }]);
        await Order.updateOne({ _id: order._id }, { $set: { paymentAttemptAt: new Date() } });
        const stripe = paymentStub();
        const canceled = await cancelReservedOrder(order._id, user, stripe);
        assert.equal(canceled.paymentStatus, 'canceled');
        assert.equal((await stripe.paymentIntents.retrieve(canceled.paymentIntentId)).status, 'canceled');
        assert.equal((await Product.findById(product._id)).stock, 5);
    });
    await t.test('expired idempotency windows cannot silently create a second intent', async () => {
        const product = await inventory();
        const order = await createPricedOrder(user, [{ product: String(product._id), quantity: 1 }]);
        await Order.updateOne({ _id: order._id }, { $set: { paymentAttemptAt: new Date(Date.now() - 25 * 3600000) } });
        const stripe = paymentStub();
        await assert.rejects(createOrderPayment(order._id, user, stripe), { statusCode: 409 });
        await assert.rejects(cancelReservedOrder(order._id, user, stripe), { statusCode: 409 });
        assert.equal(stripe.calls, 0);
        assert.equal((await Product.findById(product._id)).stock, 4);
    });
    await t.test('a webhook arriving before intent linking safely attaches the reference', async () => {
        const product = await inventory();
        const order = await createPricedOrder(user, [{ product: String(product._id), quantity: 1 }]);
        await Order.updateOne({ _id: order._id }, { $set: { paymentAttemptAt: new Date() } });
        await applyPaymentEvent({ type: 'payment_intent.succeeded', data: { object: {
            id: 'pi_early', amount: order.totalMinor, amount_received: order.totalMinor,
            currency: 'usd', metadata: { orderId: String(order._id) },
        } } });
        const paid = await Order.findById(order._id);
        assert.equal(paid.paymentStatus, 'paid');
        assert.equal(paid.paymentIntentId, 'pi_early');
    });
});
