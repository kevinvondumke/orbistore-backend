import { verifyToken } from '../services/jwt.service.js';
import { COOKIE_NAME } from '../utils/cookies.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import User from '../models/user.model.js';

/**
 * Authenticates user from HttpOnly JWT cookie
 * @type {import('express').RequestHandler}
 */
export const authenticate = async (req, res, next) => {
    try {
        const token = req.cookies?.[COOKIE_NAME];
        if (!token) throw new UnauthorizedError('No token provided, authorization denied');

        const decoded = verifyToken(token);
        if (typeof decoded !== 'object' || !decoded || typeof decoded.id !== 'string' ||
            !/^[a-fA-F0-9]{24}$/.test(decoded.id)) {
            throw new UnauthorizedError('Invalid token payload');
        }

        const user = await User.findById(decoded.id).select('-password');
        if (!user) throw new UnauthorizedError('User not found');

        req.user = user;
        return next();
    } catch (error) {
        return next(error);
    }
};

/**
 * Authorize specific roles (e.g. authorize('merchant', 'admin'))
 * @param  {...string} roles 
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) return next(new UnauthorizedError());
        if (!roles.includes(req.user.role)) {
            return next(new ForbiddenError(`Access denied. Requires one of: ${roles.join(', ')}`));
        }
        next();
    };
};

// Convenience role guards
export const requireShopper = authorize('shopper', 'merchant', 'admin');
export const requireTenantAdmin = authorize('merchant', 'admin');
export const requireSuperAdmin = authorize('admin');