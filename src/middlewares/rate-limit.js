import { rateLimit } from 'express-rate-limit';
import { env } from '../config/env.js';
import { MongoRateLimitStore } from '../services/rate-limit.store.js';

const options = (prefix, limit, skipSuccessfulRequests = false) => ({
    windowMs: 15 * 60 * 1000, limit, skipSuccessfulRequests,
    standardHeaders: /** @type {const} */ ('draft-8'), legacyHeaders: false,
    passOnStoreError: false,
    message: { status: 'fail', error: 'Too many requests; please try again later.' },
    ...(env.RATE_LIMIT_STORE === 'mongo' ? { store: new MongoRateLimitStore(prefix) } : {}),
});
// Login failures and registration have independent budgets. Logout uses only the API limit.
export const authRateLimiter = rateLimit(options('login:', 10, true));
export const registerRateLimiter = rateLimit(options('register:', 10));
export const apiRateLimiter = rateLimit(options('api:', 300));
