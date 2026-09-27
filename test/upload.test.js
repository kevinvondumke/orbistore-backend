import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import './setup.js';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import { signToken } from '../src/services/jwt.service.js';
import { COOKIE_NAME } from '../src/utils/cookies.js';

test('Upload Routes', async (t) => {
    let server;
    let baseUrl;

    // INIT SERVER BEFORE TESTS
    before(async () => {
        server = app.listen(0);
        const { port } = server.address();
        baseUrl = `http://127.0.0.1:${port}`;
    });

    // CLOSE SERVER AFTER TESTS
    after(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    // TEST FOR UNAUTHENTICATED REQUEST
    await t.test('POST /api/uploads - rejects unauthenticated requests with 401', async () => {
        const response = await fetch(`${baseUrl}/api/uploads`, {
            method: 'POST',
            headers: {
                Origin: process.env.CLIENT_URL
            }
        });

        assert.equal(response.status, 401);
    });

    // TEST FOR NON-ADMIN USER
    await t.test('POST /api/uploads - rejects non-admin users with 403', async (t2) => {
        const id = '64a1b2c3d4e5f67890123456';
        t2.mock.method(User, 'findById', () => ({
            select: async () => ({ _id: id, role: 'shopper' })
        }));

        const shopperToken = signToken({ id, role: 'shopper' });

        const response = await fetch(`${baseUrl}/api/uploads`, {
            method: 'POST',
            headers: {
                Origin: process.env.CLIENT_URL,
                Cookie: `${COOKIE_NAME}=${shopperToken}`
            }
        });

        assert.equal(response.status, 403);
    });

    // TEST FOR MISSING FILE IN REQUEST
    await t.test('POST /api/uploads - rejects requests without a file with 400', async (t2) => {
        const id = '64a1b2c3d4e5f67890123457';
        t2.mock.method(User, 'findById', () => ({
            select: async () => ({ _id: id, role: 'admin' })
        }));

        const adminToken = signToken({ id, role: 'admin' });

        const response = await fetch(`${baseUrl}/api/uploads`, {
            method: 'POST',
            headers: {
                Origin: process.env.CLIENT_URL,
                Cookie: `${COOKIE_NAME}=${adminToken}`
            }
        });

        assert.equal(response.status, 400);
        const body = await response.json();
        assert.equal(body.status, 'fail');
    });
});