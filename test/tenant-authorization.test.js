import assert from 'node:assert/strict';
import { test } from 'node:test';

// DEPENDENCIES
import mongoose from 'mongoose';
import { requireTenantAdmin } from '../src/middlewares/auth.middleware.js';
import { ForbiddenError } from '../src/utils/errors.js';

test('SECURITY: TENANT MEMBERSHIP AUTHORIZATION', async (t) => {
    // SHARED MOCK TEST TENANT IDS
    const grandlatteTenantId = new mongoose.Types.ObjectId();
    const boutiqueTeaTenantId = new mongoose.Types.ObjectId();

    // NEGATIVE TEST --> CROSS-TENANT READ/ACCESS
    await t.test('rejects merchant attempting to access a foreign store with 403 Forbidden', () => {
        // ARRANGE
        const req = {
            user: {
                id: new mongoose.Types.ObjectId().toString(),
                name: 'Marcus Rivera',
                role: 'merchant',
                tenantId: grandlatteTenantId.toString(),
            },
            tenantId: boutiqueTeaTenantId.toString()
        };
        const res = {};
        let captError = null;

        // ACT
        requireTenantAdmin(req, res, (err) => {
            captError = err;
        });

        // ASSERT
        assert.ok(captError instanceof ForbiddenError, 'Should return a ForbiddenError instance');
        assert.equal(captError.statusCode, 403, 'HTTP status code must be 403');
        assert.equal(
            captError.message,
            'Forbidden: You do not have permission to manage this store'
        );
    });

    // NEGATIVE TEST --> CROSS-TENANT MUTATION (MISSING/UNASSIGNED TENANT)
    await t.test('rejects merchant attempting to access a store without tenant assignment with 403 Forbidden', () => {
        // ARRANGE
        const req = {
            user: {
                id: new mongoose.Types.ObjectId().toString(),
                name: 'Marcus Rivera',
                role: 'merchant',
                tenantId: null
            },
            tenantId: grandlatteTenantId.toString()
        };
        const res = {};
        let capturedError = null;

        // ACT
        requireTenantAdmin(req, res, (err) => {
            capturedError = err;
        });

        // ASSERT
        assert.ok(capturedError instanceof ForbiddenError, 'Merchant is not assigned to any tenant store');
        assert.equal(capturedError.statusCode, 403, 'HTTP status code must be 403');
        assert.equal(capturedError.message, 'Merchant is not assigned to any tenant store');
    });

    // POSITIVE TEST --> AUTHORIZED OPERATION (MERCHANT WITH TENANT)
    await t.test('allows merchant with tenant assignment to access their own store', () => {
        // ARRANGE
        const req = {
            user: {
                id: new mongoose.Types.ObjectId().toString(),
                name: 'Marcus Rivera',
                role: 'merchant',
                tenantId: grandlatteTenantId
            },
            tenantId: grandlatteTenantId
        };
        const res = {};

        // ASSERT
        let nextCalled = false;
        requireTenantAdmin(req, res, (err) => {
            assert.equal(err, undefined);
            nextCalled = true;
        });
        assert.equal(nextCalled, true);
        assert.ok(req.tenantId.equals(grandlatteTenantId), 'req.tenantId should match the merchant\'s tenantId');
    });

    // PLATFORM ADMIN TEST --> SUPER ADMIN ACCESS (PLATFORM-WIDE)
    await t.test('allows platform admin to access any store', () => {
        // ARRANGE
        const req = {
            user: {
                id: new mongoose.Types.ObjectId().toString(),
                name: 'James Madison',
                role: 'admin',
                tenantId: null
            },
            tenantId: grandlatteTenantId.toString()
        };
        const res = {};

        // ASSERT
        let nextCalled = false;
        requireTenantAdmin(req, res, (err) => {
            assert.equal(err, undefined);
            nextCalled = true;
        });
        assert.equal(nextCalled, true);
        assert.equal(req.tenantId.toString(), grandlatteTenantId.toString());
    });

    // SHOPPER REJECTION --> DENIED BY REQUIRE TENANT ADMIN
    await t.test('rejects reg shopper from accessing merchant admin --> routes with 403 Forbidden', () => {
        // ARRANGE
        const req = {
            user: {
                id: new mongoose.Types.ObjectId().toString(),
                name: 'Samantha Lee',
                role: 'shopper',
                tenantId: null
            },
            tenantId: grandlatteTenantId
        };
        const res = {};
        let capturedError = null;

        // ACT
        requireTenantAdmin(req, res, (err) => {
            capturedError = err;
        });

        // ASSERT
        assert.ok(capturedError instanceof ForbiddenError, 'Should return a ForbiddenError instance');
        assert.equal(capturedError.statusCode, 403, 'HTTP status code must be 403');
        assert.equal(capturedError.message, 'Merchant or Admin access required');
    });

    // MISSING CONTEXT --> DEF SAFELY MERCHANT STORE
    await t.test('defaults req.tenantId to user.tenantId when no tenant context is provided in request', () => {
        // ARRANGE
        const req = {
            user: {
                id: new mongoose.Types.ObjectId().toString(),
                name: 'Marcus Rivera',
                role: 'merchant',
                tenantId: grandlatteTenantId
            },
            tenantId: undefined // --> NO HEADER || SUBDOMAIN
        };
        const res = {};
        let nextCalled = false;

        // ACT
        requireTenantAdmin(req, res, (err) => {
            assert.equal(err, undefined);
            nextCalled = true;
        });

        // ASSERT
        assert.equal(nextCalled, true);
        assert.ok(req.tenantId.equals(grandlatteTenantId), 'req.tenantId should default to the merchant\'s tenantId when no tenant context is provided');
    });
});