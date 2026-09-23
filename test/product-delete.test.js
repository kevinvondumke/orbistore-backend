import assert from 'node:assert/strict';
import { test } from 'node:test';
import Product from '../src/models/product.model.js';
import { deleteProduct } from '../src/controllers/product.controller.js';
import { BadRequestError, NotFoundError } from '../src/utils/errors.js';

const productId = '507f1f77bcf86cd799439011';

async function invoke(id) {
    const responses = [];
    const errors = [];
    await deleteProduct(
        { params: { id } },
        { json: body => responses.push(body) },
        error => errors.push(error),
    );
    return { responses, errors };
}

test('deletion sends only the requested product ID to the collection', async t => {
    // Mock below Mongoose so the test catches accidentally empty query filters.
    const deletion = t.mock.method(Product.collection, 'findOneAndDelete', async filter => {
        assert.deepEqual(Object.keys(filter), ['_id']);
        assert.equal(filter._id.toString(), productId);
        return { _id: filter._id, name: 'Test product' };
    });
    const result = await invoke(productId);
    assert.equal(deletion.mock.callCount(), 1);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.responses, [{ message: 'Product Deleted' }]);
});

test('invalid or missing IDs never reach the database', async t => {
    const deletion = t.mock.method(Product.collection, 'findOneAndDelete', async () => {
        assert.fail('Invalid IDs must not reach the collection');
    });
    for (const id of [undefined, null, '', 'invalid', 'a'.repeat(23), 'g'.repeat(24), {}, []]) {
        const result = await invoke(id);
        assert.deepEqual(result.responses, []);
        assert.equal(result.errors.length, 1);
        assert.ok(result.errors[0] instanceof BadRequestError);
        assert.equal(result.errors[0].statusCode, 400);
    }
    assert.equal(deletion.mock.callCount(), 0);
});

test('missing product forwards a 404 instead of reporting success', async t => {
    t.mock.method(Product.collection, 'findOneAndDelete', async () => null);
    const result = await invoke(productId);
    assert.deepEqual(result.responses, []);
    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0] instanceof NotFoundError);
    assert.equal(result.errors[0].statusCode, 404);
});

test('database failures are forwarded to the central error handler', async t => {
    const failure = new Error('Database unavailable');
    t.mock.method(Product.collection, 'findOneAndDelete', async () => { throw failure; });
    const result = await invoke(productId);
    assert.deepEqual(result.responses, []);
    assert.deepEqual(result.errors, [failure]);
});
