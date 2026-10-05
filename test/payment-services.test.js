import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrustedAmount } from '../src/services/payment.service.js';
import { ConflictError } from '../src/utils/errors.js';

test('Payment & Pricing Services: getTrustedAmount', async (t) => {
    await t.test('calculates and validates trusted amount with priceMinor', () => {
        const order = {
            pricingVersion: 1,
            currency: 'USD',
            totalMinor: 5800,
            items: [
                { priceMinor: 1850, quantity: 2 },
                { priceMinor: 2100, quantity: 1 }
            ]
        };
        const amount = getTrustedAmount(order);
        assert.equal(amount, 5800);
    });

    await t.test('calculates and validates trusted amount with dollar price fallback', () => {
        const order = {
            pricingVersion: 1,
            currency: 'usd',
            totalMinor: 5000,
            items: [
                { price: 32.00, quantity: 1 },
                { price: 18.00, quantity: 1 }
            ]
        };
        const amount = getTrustedAmount(order);
        assert.equal(amount, 5000);
    });

    await t.test('rejects mismatched item sums', () => {
        const order = {
            pricingVersion: 1,
            currency: 'USD',
            totalMinor: 6000, // Does not match 1850*2 + 2100 = 5800
            items: [
                { priceMinor: 1850, quantity: 2 },
                { priceMinor: 2100, quantity: 1 }
            ]
        };
        assert.throws(() => getTrustedAmount(order), ConflictError);
    });

    await t.test('rejects unsupported currencies or pricing versions', () => {
        assert.throws(() => getTrustedAmount({
            pricingVersion: 2,
            currency: 'USD',
            totalMinor: 1000,
            items: [{ priceMinor: 1000, quantity: 1 }]
        }), ConflictError);

        assert.throws(() => getTrustedAmount({
            pricingVersion: 1,
            currency: 'EUR',
            totalMinor: 1000,
            items: [{ priceMinor: 1000, quantity: 1 }]
        }), ConflictError);
    });
});
