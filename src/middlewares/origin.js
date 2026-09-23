import { env } from '../config/env.js';
import { ForbiddenError } from '../utils/errors.js';

// Every browser mutation, including login/logout, must come from the configured UI.
// Non-browser clients must explicitly provide this Origin too.
/** @type {import('express').RequestHandler} */
export function requireTrustedOrigin(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('origin') !== env.CLIENT_URL) return next(new ForbiddenError('Untrusted request origin'));
    next();
}
