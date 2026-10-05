import { env } from '../config/env.js';
import { ForbiddenError } from '../utils/errors.js';

// Every browser mutation, including login/logout, must come from the configured UI.
// Non-browser clients (Postman, curl) and local subdomains are supported in development.
/** @type {import('express').RequestHandler} */
export function requireTrustedOrigin(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const origin = req.get('origin');

    // In development/test mode: allow non-browser tools (no Origin header) and localhost origins
    if (env.NODE_ENV !== 'production') {
        if (!origin) return next();
        if (origin === env.CLIENT_URL || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return next();
        }
    }

    if (origin !== env.CLIENT_URL) {
        return next(new ForbiddenError('Untrusted request origin'));
    }
    next();
}
