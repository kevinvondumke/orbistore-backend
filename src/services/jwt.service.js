import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// SIGN TOKEN
export const signToken = payload => jwt.sign(
    payload,
    env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: env.JWT_EXPIRES_IN_SECONDS,
    }
);

// VERIFY TOKEN
export const verifyToken = token => jwt.verify(
    token,
    env.JWT_SECRET,
    { algorithms: ['HS256'] }
);
