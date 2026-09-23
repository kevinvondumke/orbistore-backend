import { BadRequestError } from '../utils/errors.js';

/**
 * @param {import('zod').ZodType} schema
 * @param {'body' | 'params' | 'query'} source
 * @returns {import('express').RequestHandler}
 */
export const validateRequest = (schema, source = 'body') => (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
        const details = result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message }));
        return next(new BadRequestError(details.map(issue => issue.field ? issue.field + ': ' + issue.message : issue.message).join('; '), details));
    }
        
    if (source === 'query') res.locals.query = result.data;
    else if (source === 'body') req.body = result.data;
    else Object.assign(req.params, result.data);
    next();
};
