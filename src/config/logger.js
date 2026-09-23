// CUSTOM FORMATS AND TRANSPORTS
// RFC-5424 LOG LEVELS [ERROR (0), WARN (1), INFO (2), HTTP (3), DEBUG (4)]
// ENV-AWARE FORMATTING: DEVELOPMENT (DEV) | PRODUCTION (PROD)

import winston from 'winston';
import { env } from './env.js';

const {
    combine,
    timestamp,
    printf,
    colorize,
    json,
    errors
} = winston.format;

// CUSTOM LOCAL DEV FORMAT
const devFormat = printf(
    ({ level, message, timestamp: time, stack }) => {
        return `${time} ${level}: ${stack || message}`;
    }
);

// CUSTOM PROD FORMAT
const prodFormat = combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    json()
);

// DETERMINE LOG LEVEL BASED ON ENVIRONMENT
const level = env.NODE_ENV === 'development' ? 'debug' : 'info';

// CREATE LOGGER INSTANCE -->
export const logger = winston.createLogger({
    // LEVEL BASED ON ENV
    level,

    // FORMAT BASED ON ENV
    format: env.NODE_ENV === 'production' ? prodFormat : combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        devFormat
    ),

    // TRANSPORT BASED ON ENV & SILENT IN TEST ENV
    transports: [
        new winston.transports.Console({
            silent: env.NODE_ENV === 'test'
        })
    ]
});