import User from '../models/user.model.js';
import { comparePassword, hashPassword } from '../services/auth.service.js';
import { signToken } from '../services/jwt.service.js';
import { ConflictError, UnauthorizedError } from '../utils/errors.js';
import { COOKIE_NAME, getAuthCookieOptions, getClearCookieOptions } from '../utils/cookies.js';

/**
 * @typedef {import('zod').infer<typeof import('../schemas/auth.schema.js').registerSchema>} RegisterBody
 * @typedef {import('zod').infer<typeof import('../schemas/auth.schema.js').loginSchema>} LoginBody
 */

// REGISTER NEW USER AND GENERATE JWT TOKEN
/**
 * @type {import('express').RequestHandler<{}, any, RegisterBody>}
 */
export const register = async (req, res, next) => {
    try {
        const {
            name,
            email,
            password,
            avatarUrl
        } = req.body;

        // VERIFY IF USER ALREADY EXISTS
        const userCheck = await User.findOne({ email });
        if (userCheck) {
            throw new ConflictError('Email already exists.');
        }

        // HASH PASSWORD AND CREATE NEW USER
        const hashed = await hashPassword(password);
        const user = await User.create({ name, email, password: hashed, avatarUrl: avatarUrl ?? '' });

        res.cookie(
            COOKIE_NAME,
            signToken({ id: user._id, email: user.email }),
            getAuthCookieOptions()
        );

        return res.status(201).json({
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                avatarUrl: user.avatarUrl,
            },
        });
    } catch (error) {
        next(error);
    }
};

// LOGIN USER AND GENERATE JWT TOKEN
/**
 * @type {import('express').RequestHandler<{}, any, LoginBody>}
 */
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // VERIFY USER EXISTS AND PASSWORD MATCHES
        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            throw new UnauthorizedError('Invalid login credentials');
        }
        const passMatch = await comparePassword(password, user.password);
        if (!passMatch) {
            throw new UnauthorizedError('Invalid login credentials');
        }

        // SIGN JWT TOKEN
        const token = signToken({
            id: user._id,
            email: user.email,
            platformRole: user.role,
            tenantId: user.tenantId,
            tenantRole: user.tenantRole
        });

        // SET AUTH COOKIE WITH USER JWT TOKEN AND INFO
        res.cookie(COOKIE_NAME, token, getAuthCookieOptions());
        return res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
            }
        });
    } catch (error) {
        next(error);
    }
};

// LOGOUT USER BY CLEARING TOKEN COOKIE
/**
 * @type {import('express').RequestHandler}
 */
export async function logout(req, res, next) {
    try {
        res.clearCookie(COOKIE_NAME, getClearCookieOptions());
        return res.json({ message: 'Logged out successfully' });
    } catch (error) {
        next(error);
    }
}
