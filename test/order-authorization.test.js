import './setup.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';

import Order from '../src/models/order.model.js';
import { updateOrderStatus } from '../src/controllers/order.controller.js';
import { requireTenantAdmin } from '../src/middlewares/auth.middleware.js';
import { NotFoundError, ConflictError } from '../src/utils/errors.js';

const GRANDLATTE_TENANT_ID = '507f1f77bcf86cd799439011';
const TEA_TENANT_ID = '507f1f77bcf86cd799439012';
const MARCUS_ID = '507f1f77bcf86cd799439013';
const TEA_ORDER_ID = '507f1f77bcf86cd799439014';
const GRANDLATTE_ORDER_ID = '507f1f77bcf86cd799439015';

// MATCHING THE CONTROLLER'S EQUALITY FILTERS
function matches(order, filter) {
    return Object.entries(filter).every(
        ([key, value]) => String(order[key]) === String(value)
    );
};

// PERSISTENCE WHILE CHECKING --> EVERY QUERY PRESERVES OWNERSHIP
function mockOrders(t, orders) {

    // CHECKS --> UPDATE AND FALLBACK LOOKUP
    function assertScoped(filter) {
        assert.ok(filter._id, 'Order lookup must include an ID');
        assert.equal(
            String(filter.tenantId),
            GRANDLATTE_TENANT_ID,
            'Merchant queries must include the authorized tenant'
        );
    };

    const update = t.mock.method(
        Order,
        'findOneAndUpdate',
        async (filter, changes) => {
            assertScoped(filter);

            const order = orders.find(item => matches(item, filter));
            if (!order) {
                return null;
            }

            Object.assign(order, changes.$set);
            return { ...order };
        }
    );

    const lookup = t.mock.method(
        Order,
        'findOne',
        async filter => {
            assertScoped(filter);

            const order = orders.find(item => matches(item, filter));
            return order ? { ...order } : null;
        }
    );

    // FAIL IMMEDIATELY IF THE OLD UNSAFE FALLBACK <-- REINTRODUCED!!!
    t.mock.method(Order, 'findById', async () => {
        assert.fail('Merchant fallback must not use unscoped findById!!');
    });

    return { update, lookup };
};

// 1. MEMBERSHIP MIDD --> 2. CONTROLLER
async function invoke({
    orderId,
    tenantId,
    fulfillmentStatus = 'processing',
}) {
    const req = {
        user: {
            _id: MARCUS_ID,
            role: 'merchant',
            tenantId: GRANDLATTE_TENANT_ID,
        },
        tenantId,
        params: { id: orderId },
        body: { fulfillmentStatus }
    };

    let middlewareError;

    requireTenantAdmin(req, {}, error => {
        middlewareError = error;
    });

    if (middlewareError) {
        throw middlewareError;
    };

    let response, error;

    await updateOrderStatus(
        req,
        {
            json(body) {
                response = body;
                return this;
            },
        },
        failure => {
            error = failure;
        }
    );

    return { req, response, error };
};


// TEST #1 | AN ALLOWED STORE CONTEXT --> CANNOT EXPOSE A FOREIGN RES ID
test('merchant cannot access foreign paid order through own-store context', async t => {
    const foreignOrder = {
        _id: TEA_ORDER_ID,
        tenantId: TEA_TENANT_ID,
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
    };

    mockOrders(t, [foreignOrder]);

    const result = await invoke({
        orderId: TEA_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID
    });

    assert.ok(result.error instanceof NotFoundError);
    assert.equal(result.error.statusCode, 404);
    assert.equal(result.response, undefined);
    assert.equal(foreignOrder.fulfillmentStatus, 'unfulfilled');
});

// TEST #2 | DEFAULTING TO GRANDLATTER STORE STILL PRESERVES ISOLATION
test('merchant cannot access foreign paid order without a tenant selector', async t => {
    const foreignOrder = {
        _id: TEA_ORDER_ID,
        tenantId: TEA_TENANT_ID,
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
    };

    mockOrders(t, [foreignOrder]);

    const result = await invoke({
        orderId: TEA_ORDER_ID,
        tenantId: undefined
    });

    // MIDD --> RESOLVE MISSING CONTEXT TO GRANDLATTE STORE
    assert.equal(String(result.req.tenantId), GRANDLATTE_TENANT_ID);
    assert.ok(result.error instanceof NotFoundError);
    assert.equal(result.error.statusCode, 404);
    assert.equal(result.response, undefined);
    assert.equal(foreignOrder.fulfillmentStatus, 'unfulfilled');
});

// TEST #3 | BEING PAID DOES NOT JUSTIFY --> RETURNING SUCCESS FOR AN INVALID TRANSITION
test('own-store order rejects an invalid fulfillment transition', async t => {
    const ownOrder = {
        _id: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
    };

    mockOrders(t, [ownOrder]);

    const result = await invoke({
        orderId: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        fulfillmentStatus: 'shipped'
    });

    assert.ok(result.error instanceof ConflictError);
    assert.equal(result.error.statusCode, 409);
    assert.equal(result.response, undefined);
    assert.equal(ownOrder.fulfillmentStatus, 'unfulfilled');
});

// TEST #4 | 
test('own-store paid order allows the next fulfillment transition', async t => {
    const ownOrder = {
        _id: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled'
    };

    const { update, lookup } = mockOrders(t, [ownOrder]);

    const result = await invoke({
        orderId: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        fulfillmentStatus: 'processing'
    });

    assert.equal(result.error, undefined);
    assert.equal(result.response.fulfillmentStatus, 'processing');
    assert.equal(update.mock.callCount(), 1);
    assert.equal(lookup.mock.callCount(), 0);
});

// TEST #5 | SEQUENTIAL STATE MACHINE PROGRESSION
test('own-store paid order allows progresses through processing -> shipped -> delivered in sequence', async t => {
    const ownOrder = {
        _id: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled'
    };

    const { update, lookup } = mockOrders(t, [ownOrder]);

    for (const nextStatus of ['processing', 'shipped', 'delivered']) {
        const result = await invoke({
            orderId: GRANDLATTE_ORDER_ID,
            tenantId: GRANDLATTE_TENANT_ID,
            fulfillmentStatus: nextStatus
        });

        assert.equal(result.error, undefined, `Transition to ${nextStatus} should succeed`);
        assert.equal(result.response.fulfillmentStatus, nextStatus);
        assert.equal(ownOrder.fulfillmentStatus, nextStatus);
    }

    assert.equal(update.mock.callCount(), 3);
    assert.equal(lookup.mock.callCount(), 0);
});

// TEST #6 | UNPAID ORDER --> REJECTION
test('own-store unpaid order rejects any fulfillment transition', async t => {
    const unpaidOrder = {
        _id: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        paymentStatus: 'pending',
        fulfillmentStatus: 'unfulfilled'
    };

    mockOrders(t, [unpaidOrder]);

    const result = await invoke({
        orderId: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        fulfillmentStatus: 'processing'
    });

    assert.ok(result.error instanceof ConflictError);
    assert.equal(result.error.statusCode, 409);
    assert.equal(result.response, undefined);
    assert.equal(unpaidOrder.fulfillmentStatus, 'unfulfilled');
});

// TEST #7 | REVERSED TRANSITION --> REJECTION
test('own-store paid order rejects reversed fulfillment transition with 409 Conflict', async t => {
    const deliveredOrder = {
        _id: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        paymentStatus: 'paid',
        fulfillmentStatus: 'delivered'
    };

    mockOrders(t, [deliveredOrder]);

    const result = await invoke({
        orderId: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        fulfillmentStatus: 'processing'
    });

    assert.ok(result.error instanceof ConflictError);
    assert.equal(result.error.statusCode, 409);
    assert.equal(result.response, undefined);
    assert.equal(deliveredOrder.fulfillmentStatus, 'delivered');
});

// TEST #8 | IDEMPOTENT RETRY OF THE ALREADY-APPLIED TRANSITION | AKA 200 OK
test('retrying an already-applied transition on a paid own-store order succeeds idempotently', async t => {
    const alreadyProcessingOrder = {
        _id: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        paymentStatus: 'paid',
        fulfillmentStatus: 'processing'
    };

    const { update, lookup } = mockOrders(t, [alreadyProcessingOrder]);

    const result = await invoke({
        orderId: GRANDLATTE_ORDER_ID,
        tenantId: GRANDLATTE_TENANT_ID,
        fulfillmentStatus: 'processing'
    });

    assert.equal(result.error, undefined);
    assert.equal(result.response.fulfillmentStatus, 'processing');
    assert.equal(update.mock.callCount(), 1);
    assert.equal(lookup.mock.callCount(), 1);
});

// TEST #9 | REAL MONGOOSE SCHEMA PERSISTENCE + VALIDATION
test('Order Mongoose schema persists fulfillmentStatus and enforces enum invariants', async t => {
    const order = new Order({
        tenantId: GRANDLATTE_TENANT_ID,
        userId: MARCUS_ID,
        orderNumber: 'ORB-TEST-001',
        items: [{
            productId: '507f1f77bcf86cd799439099',
            name: 'Grand Blend',
            prive: 18.5,
            priceMinor: 1850,
            quantity: 1
        }],
        total: 18.5,
        totalMinor: 1850
    });

    // --> DEFAULT STATE: 'unfulfilled'
    assert.equal(order.fulfillmentStatus, 'unfulfilled');
    assert.equal(order.validateSync(), undefined);

    // RETAINED AND VALIDATED --> TRANSITION
    for (const status of ['processing', 'shipped', 'delivered']) {
        order.set({ fulfillmentStatus: status });
        assert.equal(order.fulfillmentStatus, status);
        assert.equal(order.validateSync(), undefined);
    };

    // INVALID STATUS --> REJECTED 
    order.set({ fulfillmentStatus: 'lost-in-transit' });
    const validationError = order.validateSync();
    assert.ok(validationError, 'Invalid fulfillmentStatus must fail schema validation');
    assert.ok(validationError.errors.fulfillmentStatus);
});

// ALL TESTS
test.todo('integration --> authorized fulfillment transition persists after MongoDB reload');