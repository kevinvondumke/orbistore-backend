import { env } from '../config/env.js';
export const COOKIE_NAME = 'auth_token';

// CLEAR COOKIE OPTIONS
/** @returns {import('express').CookieOptions} */
export const getClearCookieOptions = () => ({
    httpOnly: true, secure: env.NODE_ENV === 'production',
    sameSite: env.COOKIE_SAME_SITE, path: '/',
});

// GET AUTH COOKIE OPTIONS
/** @returns {import('express').CookieOptions} */
export const getAuthCookieOptions = () => ({
    ...getClearCookieOptions(), maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000,
});
