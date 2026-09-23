import { z } from 'zod';

// EMAIL SCHEMA
const email = z.string({ error: issue => issue.input === undefined ? 'Email is required' : 'Email must be a string' })
    .trim().toLowerCase().max(255).pipe(z.email('Invalid email format'));

// PASSWORD SCHEMA
const password = z.string({ error: issue => issue.input === undefined ? 'Password is required' : 'Password must be a string' })
    .min(1, 'Password cannot be empty')
    .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');

// REGISTER SCHEMA
export const registerSchema = z.object({
    email,
    name: z.string().trim().min(2).max(40)
        .regex(/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u, 'Name must contain letters separated by spaces, apostrophes or hyphens'),
    password: password.refine(value => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(value),
        'Password must contain at least 8 characters, uppercase, lowercase, a number and a special character'),
    avatarUrl: z.string().trim().pipe(z.union([z.literal(''), z.url().refine(value =>
        /^https?:\/\//.test(value), 'Use an HTTP(S) avatar URL')])).nullable().optional(),
});

// LOGIN SCHEMA
export const loginSchema = z.object(
    { email, password }
);
