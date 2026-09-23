import './setup.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { envSchema } from '../src/schemas/env.schema.js';
import { registerSchema, loginSchema } from '../src/schemas/auth.schema.js';
import { createProductSchema, updateProductSchema } from '../src/schemas/product.schema.js';
import { authenticate } from '../src/middlewares/auth.middleware.js';
import { signToken } from '../src/services/jwt.service.js';
import { getReadiness } from '../src/middlewares/health.controller.js';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import User from '../src/models/user.model.js';
import { getAuthCookieOptions, getClearCookieOptions } from '../src/utils/cookies.js';

test('app imports without connecting to the database', () => assert.equal(mongoose.connection.readyState, 0));
test('auth accepts the shared cookie and rejects deleted users', async t => {
    const id = '507f1f77bcf86cd799439011';
    let found = { _id: id, role: 'user' };
    t.mock.method(User, 'findById', () => ({ select: async () => found }));
    const req = { cookies: { auth_token: signToken({ id }) } };
    const calls = [];
    await authenticate(req, {}, error => calls.push(error));
    assert.equal(req.user, found);
    assert.deepEqual(calls, [undefined]);
    found = null;
    await authenticate(req, {}, error => calls.push(error));
    assert.equal(calls[1].statusCode, 401);
});
test('database auth errors are not disguised as invalid tokens', async t => {
    const error = new Error('DB unavailable');
    t.mock.method(User, 'findById', () => ({ select: async () => { throw error; } }));
    let forwarded;
    await authenticate({ cookies: { auth_token: signToken({ id: '507f1f77bcf86cd799439011' }) } }, {}, value => { forwarded = value; });
    assert.equal(forwarded, error);
});
test('disconnected readiness returns 503', () => {
    let status;
    getReadiness({}, { status(code) { status = code; return this; }, json() {} });
    assert.equal(status, 503);
});
test('environment rejects invalid ports, URIs, missing payment configuration and weak secrets', () => {
    for (const override of [{ PORT: '' }, { PORT: -1 }, { PORT: 1.5 }, { PORT: 70000 },
        { DATABASE_URL: 'invalid' }, { JWT_SECRET: 'short' }, { CLIENT_URL: 'invalid' },
        { CLIENT_URL: 'https://example.com/path' }, { STRIPE_SECRET_KEY: '' }, { STRIPE_WEBHOOK_SECRET: '' },
        { NODE_ENV: 'production', RATE_LIMIT_STORE: 'memory', CLIENT_URL: 'https://example.com' }]) {
        assert.equal(envSchema.safeParse({ ...env, ...override }).success, false);
    }
});
test('auth schema enforces UTF-8 bytes and supports real names and empty avatars', () => {
    const base = { name: "Mar\u00eda O'Connor", email: 'USER@example.com', password: 'ValidPass1!' };
    assert.equal(registerSchema.safeParse({ ...base, avatarUrl: '   ' }).success, true);
    assert.equal(registerSchema.safeParse({ ...base, name: 'A\u00d7B' }).success, false);
    assert.equal(registerSchema.safeParse({ ...base, password: 'Aa1!' + '\u00e9'.repeat(35) }).success, false);
    assert.equal(loginSchema.safeParse({ email: base.email, password: 'x'.repeat(73) }).success, false);
});
test('product schemas reject operators, empty updates and invalid prices/stock', () => {
    for (const body of [{ name: 'A', price: -1 }, { name: 'A', price: 1.001 },
        { name: 'A', price: 1, stock: 1.5 }, { name: 'A', price: 1, $set: { stock: 100 } }]) {
        assert.equal(createProductSchema.safeParse(body).success, false);
    }
    assert.equal(updateProductSchema.safeParse({}).success, false);
    assert.deepEqual(updateProductSchema.parse({ name: 'Updated' }), { name: 'Updated' });
});
test('cookie expiry matches JWT expiry and clearing uses the same attributes', () => {
    const token = jwt.decode(signToken({ id: 'test' }));
    assert.equal(token.exp - token.iat, env.JWT_EXPIRES_IN_SECONDS);
    const { maxAge, ...rest } = getAuthCookieOptions();
    assert.equal(maxAge, env.JWT_EXPIRES_IN_SECONDS * 1000);
    assert.deepEqual(rest, getClearCookieOptions());
});
test('central error handler delegates when headers were sent', () => {
    const error = new Error('late failure');
    errorHandler(error, {}, { headersSent: true }, forwarded => assert.equal(forwarded, error));
});
test('HTTP: health, origin checks, invalid JSON, size limits and input validation', async t => {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = 'http://127.0.0.1:' + server.address().port;
    const post = (body, origin = env.CLIENT_URL) => fetch(base + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body,
    });
    assert.equal((await fetch(base + '/health')).status, 200);
    assert.equal((await fetch(base + '/ready')).status, 503);
    assert.equal((await post('{}', 'https://evil.example')).status, 403);
    assert.equal((await post('{')).status, 400);
    assert.equal((await post(JSON.stringify({ value: 'x'.repeat(110000) }))).status, 413);
    assert.equal((await post('{}')).status, 400);
    assert.equal((await fetch(base + '/api/products/not-an-id')).status, 400);
    assert.equal((await fetch(base + '/api/products?page=0')).status, 400);
    const response = await fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(response.status, 400);
});
