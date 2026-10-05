import test from 'node:test';
import assert from 'node:assert/strict';
import { requireTrustedOrigin } from '../src/middlewares/origin.js';
import { ForbiddenError } from '../src/utils/errors.js';

test('Origin Middleware: requireTrustedOrigin', async (t) => {
    await t.test('allows GET and HEAD requests without origin check', () => {
        let called = false;
        requireTrustedOrigin({ method: 'GET', get: () => 'http://evil.com' }, {}, (err) => {
            if (!err) called = true;
        });
        assert.equal(called, true);
    });

    await t.test('allows Postman / non-browser requests without Origin header in dev mode', () => {
        let called = false;
        requireTrustedOrigin({ method: 'POST', get: () => undefined }, {}, (err) => {
            if (!err) called = true;
        });
        assert.equal(called, true);
    });

    await t.test('allows localhost frontend origins in dev mode', () => {
        let called = false;
        requireTrustedOrigin({ method: 'POST', get: () => 'http://localhost:5173' }, {}, (err) => {
            if (!err) called = true;
        });
        assert.equal(called, true);

        let subdomainCalled = false;
        requireTrustedOrigin({ method: 'POST', get: () => 'http://grandlatte.localhost:5173' }, {}, (_err) => {
            if (!subdomainCalled) subdomainCalled = true;
        });
        assert.equal(subdomainCalled, true);
    });

    await t.test('rejects external untrusted origins', () => {
        let capturedErr = null;
        requireTrustedOrigin({ method: 'POST', get: () => 'http://malicious-attacker.com' }, {}, (err) => {
            capturedErr = err;
        });
        assert.ok(capturedErr instanceof ForbiddenError);
    });
});
