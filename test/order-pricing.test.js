import './setup.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import Product from '../src/models/product.model.js';
import Order from '../src/models/order.model.js';
import { createOrderSchema } from '../src/schemas/order.schema.js';
import { validateRequest } from '../src/middlewares/validate.js';
import { createOrder } from '../src/controllers/order.controller.js';
import { createPricedOrder } from '../src/services/order.service.js';
import { createOrderPayment, getTrustedAmount } from '../src/services/payment.service.js';
import { dollarsToMinor } from '../src/utils/money.js';

const id = '507f1f77bcf86cd799439011';
const user = '507f1f77bcf86cd799439012';

function mockInventory(t, { product = { _id: id, name: 'Product', price: 19.99, stock: 5 }, modifiedCount = 1, saveError } = {}) {
    const session = {};
    t.mock.method(mongoose.connection, 'transaction', async callback => callback(session));
    t.mock.method(Product, 'findById', productId => {
        assert.equal(productId, id);
        return { session: async received => { assert.equal(received, session); return product; } };
    });
    const reserve = t.mock.method(Product, 'updateOne', async (filter, update, options) => {
        assert.equal(options.session, session);
        assert.equal(filter._id, id);
        assert.equal(filter.stock.$gte, -update.$inc.stock);
        return { modifiedCount };
    });
    const save = t.mock.method(Order, 'create', async (orders, options) => {
        assert.equal(options.session, session);
        if (saveError) throw saveError;
        await new Order(orders[0]).validate();
        return orders;
    });
    return { reserve, save };
}

test('request prices, totals, currency, and pricing markers cannot influence the order', async t => {
    mockInventory(t);
    const req = { user: { _id: user }, body: {
        items: [{ product: id, quantity: 2, price: 0.01, priceMinor: 1 }],
        total: 0.02, totalMinor: 2, currency: 'eur', pricingVersion: 1,
    } };
    validateRequest(createOrderSchema)(req, {}, error => assert.equal(error, undefined));
    let saved;
    await createOrder(req, {
        status(code) { assert.equal(code, 201); return this; },
        json(body) { saved = body; },
    }, error => { throw error; });
    assert.equal(saved.totalMinor, 3998);
    assert.equal(saved.total, 39.98);
    assert.equal(saved.items[0].priceMinor, 1999);
    assert.equal(saved.currency, 'usd');
    assert.equal(saved.user, user);
});

test('Zod rejects malformed items, quantities, and duplicate product IDs', () => {
    for (const body of [undefined, {}, { items: [] },
        ...[0, -1, 1.5, '2', 1001, Infinity].map(quantity => ({ items: [{ product: id, quantity }] })),
        { items: [{ product: 'invalid', quantity: 1 }] },
        { items: [{ product: id, quantity: 1 }, { product: id.toUpperCase(), quantity: 1 }] },
    ]) assert.equal(createOrderSchema.safeParse(body).success, false);
});

test('catalog decimal conversion is exact and rejects invalid precision', () => {
    assert.equal(dollarsToMinor(19.99), 1999);
    assert.equal(dollarsToMinor(0.29), 29);
    assert.equal(dollarsToMinor(10), 1000);
    for (const value of [-1, NaN, Infinity, 1.005, '10', 1000000]) {
        assert.throws(() => dollarsToMinor(value));
    }
});

test('missing products fail without reservation or order creation', async t => {
    const { reserve, save } = mockInventory(t, { product: null });
    await assert.rejects(createPricedOrder(user, [{ product: id, quantity: 1 }]), { statusCode: 404 });
    assert.equal(reserve.mock.callCount(), 0);
    assert.equal(save.mock.callCount(), 0);
});

test('insufficient stock fails without creating an order', async t => {
    const { reserve, save } = mockInventory(t);
    await assert.rejects(createPricedOrder(user, [{ product: id, quantity: 6 }]), { statusCode: 409 });
    assert.equal(reserve.mock.callCount(), 0);
    assert.equal(save.mock.callCount(), 0);
});

test('failed conditional reservation aborts the transaction callback', async t => {
    const { save } = mockInventory(t, { modifiedCount: 0 });
    await assert.rejects(createPricedOrder(user, [{ product: id, quantity: 1 }]), { statusCode: 409 });
    assert.equal(save.mock.callCount(), 0);
});

test('order persistence failure escapes the transaction callback for rollback', async t => {
    const failure = new Error('Order write failed');
    const { reserve } = mockInventory(t, { saveError: failure });
    await assert.rejects(createPricedOrder(user, [{ product: id, quantity: 1 }]), error => error === failure);
    assert.equal(reserve.mock.callCount(), 1);
});

function pricedOrder() {
    return { _id: id, user, pricingVersion: 1, currency: 'usd', totalMinor: 3998, total: 0.01,
        items: [{ priceMinor: 1999, quantity: 2 }], paymentStatus: 'pending',
        async save() {} };
}

test('Stripe receives integer cents from trusted pricing and an idempotency key', async t => {
    const order = pricedOrder();
    t.mock.method(Order, 'findOneAndUpdate', async (filter, update) => {
        Object.assign(order, update.$set);
        return order;
    });
    t.mock.method(Order, 'findOne', async filter => {
        assert.deepEqual(filter, { _id: id, user });
        return order;
    });
    const result = await createOrderPayment(id, user, { paymentIntents: {
        async create(params, options) {
            assert.equal(params.amount, 3998);
            assert.equal(params.currency, 'usd');
            assert.equal(options.idempotencyKey, `order:${id}:pricing:1`);
            return { ...params, id: 'pi_test', client_secret: 'test-only', status: 'requires_payment_method' };
        },
    } });
    assert.equal(order.paymentIntentId, 'pi_test');
    assert.equal(result.paymentIntentId, 'pi_test');
});

test('legacy, inconsistent, and non-integer order amounts cannot be charged', () => {
    for (const override of [{ pricingVersion: undefined }, { currency: 'eur' }, { totalMinor: 1 },
        { totalMinor: 3998.1 }, { totalMinor: 5000 }, { items: [] },
        { items: [{ priceMinor: -1999, quantity: -2 }] },
    ]) assert.throws(() => getTrustedAmount({ ...pricedOrder(), ...override }), { statusCode: 409 });
});

test('unknown or foreign orders never reach Stripe', async t => {
    t.mock.method(Order, 'findOne', async () => null);
    await assert.rejects(createOrderPayment(id, user, {}), { statusCode: 404 });
});

test('paid orders never reach Stripe', async t => {
    t.mock.method(Order, 'findOne', async () => ({ ...pricedOrder(), paymentStatus: 'paid' }));
    await assert.rejects(createOrderPayment(id, user, {}), { statusCode: 409 });
});

test('repeated checkout retrieves the existing intent rather than creating another', async t => {
    t.mock.method(Order, 'findOneAndUpdate', async () => ({ ...pricedOrder(), paymentIntentId: 'pi_existing' }));
    t.mock.method(Order, 'findOne', async () => ({ ...pricedOrder(), paymentIntentId: 'pi_existing' }));
    const result = await createOrderPayment(id, user, { paymentIntents: {
        async retrieve(intentId) {
            assert.equal(intentId, 'pi_existing');
            return { id: intentId, amount: 3998, currency: 'usd', status: 'requires_payment_method', client_secret: 'test-only' };
        },
        async create() { assert.fail('Must reuse the intent'); },
    } });
    assert.equal(result.paymentIntentId, 'pi_existing');
});
