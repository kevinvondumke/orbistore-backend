import { z } from 'zod';

const positiveInteger = (fallback, max) => z.coerce.number().int().min(1).max(max).default(fallback);

export const envSchema = z.object({
    // ENV VARS SCHEMA
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: positiveInteger(4400, 65535),
    DATABASE_URL: z.string().regex(/^mongodb(?:\+srv)?:\/\/[^\s]+$/, 'A MongoDB connection URI is required'),
    
    // JWT SCHEMA
    JWT_SECRET: z.string().min(32, 'Use a randomly generated JWT secret of at least 32 characters'),
    JWT_EXPIRES_IN_SECONDS: positiveInteger(3600, 604800),

    // CLIENT URL SCHEMA
    CLIENT_URL: z.url().refine(value => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && url.origin === value && !url.username && !url.password;
    }, 'CLIENT_URL must be an HTTP(S) origin without a trailing slash'),
    
    // STRIPE KEYS
    STRIPE_SECRET_KEY: z.string().regex(/^(sk|rk)_(test|live)_.+$/, 'A Stripe secret or restricted key is required'),
    STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_.+$/, 'A Stripe webhook signing secret is required'),
    COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    
    // TRUST PROXY AND RATE LIMIT STORE + RESERV MINUTES
    TRUST_PROXY: z.string().default(''),
    RATE_LIMIT_STORE: z.enum(['memory', 'mongo']).default('mongo'),
    RESERVATION_MINUTES: positiveInteger(30, 120),

    // CLOUDINARY KEYS
    CLOUDINARY_CLOUD_NAME: z.string().min(1, 'Cloudinary Cloud Name is required'),
    CLOUDINARY_API_KEY: z.string().min(1, 'Cloudinary API Key is required'),
    CLOUDINARY_API_SECRET: z.string().min(1, 'Cloudinary API Secret is required'),
}).superRefine((value, context) => {

    // CUSTOM VALIDATION FOR ENVIRONMENT VARIABLES
    if (value.COOKIE_SAME_SITE === 'none' && value.NODE_ENV !== 'production') {
        context.addIssue({ code: 'custom', path: ['COOKIE_SAME_SITE'], message: 'SameSite=None requires production HTTPS cookies' });
    }
    if (value.NODE_ENV === 'production' && value.RATE_LIMIT_STORE !== 'mongo') {
        context.addIssue({ code: 'custom', path: ['RATE_LIMIT_STORE'], message: 'Production requires the shared MongoDB rate-limit store' });
    }
    if (value.NODE_ENV === 'production' && !value.CLIENT_URL.startsWith('https://')) {
        context.addIssue({ code: 'custom', path: ['CLIENT_URL'], message: 'Production requires HTTPS' });
    }
});
