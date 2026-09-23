import './setup.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateRequest } from '../src/middlewares/validate.js';
import { registerSchema, loginSchema } from '../src/schemas/auth.schema.js';
import { BadRequestError } from '../src/utils/errors.js';

// Isolate error-handler configuration from local credentials and services.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mongodb://localhost/validation-test';
process.env.JWT_SECRET = 'validation-test-secret-at-least-32-characters';
process.env.DOTENV_CONFIG_QUIET = 'true';
const { errorHandler } = await import('../src/middlewares/errorHandler.js');
const { env } = await import('../src/config/env.js');

function validate(schema, body) {
    const req = { body };
    const calls = [];
    validateRequest(schema)(req, {}, (...args) => calls.push(args));
    assert.equal(calls.length, 1);
    return { body: req.body, error: calls[0][0] };
}

test('registration normalizes data and strips unknown properties', () => {
    const result = validate(registerSchema, {
        name: '  Kevin  ', email: '  KEVIN@example.com  ',
        password: 'ValidPass1!', avatarUrl: '  https://example.com/avatar.png  ',
        role: 'admin',
    });
    assert.equal(result.error, undefined);
    assert.deepEqual(result.body, {
        name: 'Kevin', email: 'kevin@example.com', password: 'ValidPass1!',
        avatarUrl: 'https://example.com/avatar.png',
    });
});

test('login normalizes email without modifying password', () => {
    const result = validate(loginSchema, { email: ' USER@example.com ', password: ' secret ' });
    assert.equal(result.error, undefined);
    assert.deepEqual(result.body, { email: 'user@example.com', password: ' secret ' });
});

test('invalid registration forwards field details as a BadRequestError', () => {
    const body = { name: '1', email: 'invalid', password: 'weak', avatarUrl: 'invalid' };
    const result = validate(registerSchema, body);
    assert.equal(result.body, body);
    assert.ok(result.error instanceof BadRequestError);
    assert.equal(result.error.statusCode, 400);
    assert.equal(result.error.isOperational, true);
    assert.deepEqual(new Set(result.error.details.map(issue => issue.field)),
        new Set(['name', 'email', 'password', 'avatarUrl']));
});

test('missing and incorrectly typed bodies produce validation errors', () => {
    for (const body of [undefined, null, [], 'invalid', {}, { email: 123, password: false }]) {
        assert.ok(validate(loginSchema, body).error instanceof BadRequestError);
    }
    const { error } = validate(loginSchema, {});
    assert.ok(error.details.some(issue => issue.message === 'Email is required'));
    assert.ok(error.details.some(issue => issue.message === 'Password is required'));
});

test('registration accepts omitted, null, and empty avatar URLs', () => {
    for (const avatarUrl of [undefined, null, '']) {
        assert.equal(validate(registerSchema, {
            name: 'Kevin', email: 'kevin@example.com', password: 'ValidPass1!', avatarUrl,
        }).error, undefined);
    }
});

test('central error handler returns 400 and validation details in development and production', () => {
    const { error } = validate(loginSchema, { email: 'invalid', password: '' });
    const originalEnvironment = env.NODE_ENV;
    try {
        for (const mode of ['development', 'production']) {
            env.NODE_ENV = mode;
            const res = {
                status(code) { this.statusCode = code; return this; },
                json(body) { this.body = body; return this; },
            };
            errorHandler(error, {}, res, () => assert.fail('Should send the error response'));
            assert.equal(res.statusCode, 400);
            assert.equal(res.body.status, 'fail');
            assert.equal(res.body.error, error.message);
            assert.deepEqual(res.body.details, error.details);
            if (mode === 'production') assert.equal(res.body.stack, undefined);
        }
    } finally {
        env.NODE_ENV = originalEnvironment;
    }
});
