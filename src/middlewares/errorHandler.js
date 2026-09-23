import { ApplicationError } from '../utils/errors.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

// ERROR HANDLING MIDDLEWARE
/** @type {import('express').ErrorRequestHandler} */
export function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);
    let error = err;
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) {
        error = new ApplicationError('Invalid or expired token. Please log in again.', 401);
    } else if (err.code === 11000) {
        error = new ApplicationError('A resource with those unique fields already exists', 409);
    } else if (err.name === 'CastError' || err.name === 'ValidationError') {
        error = new ApplicationError('Invalid request data', 400);
    } else if (err.type === 'entity.parse.failed') {
        error = new ApplicationError('Malformed JSON in request body', 400);
    } else if (err.type === 'entity.too.large') {
        error = new ApplicationError('Request body is too large', 413);
    } else if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
        error = new ApplicationError('Unsupported request encoding', 415);
    }
    const operational = error instanceof ApplicationError && error.isOperational;
    const statusCode = operational ? error.statusCode : 500;
    if (!operational) logger.error('Unhandled request failure:', {
        error,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method
    });
    return res.status(statusCode).json({
        status: statusCode < 500 ? 'fail' : 'error',
        error: operational || env.NODE_ENV !== 'production' ? error.message : 'Internal Server Error',
        ...(operational && error.details ? { details: error.details } : {}),
        ...(env.NODE_ENV !== 'production' ? { stack: error.stack, statusCode } : {}),
    });
}
