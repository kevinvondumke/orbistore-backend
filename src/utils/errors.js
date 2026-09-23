/* APPLICATION VALIDATION ERRORS */
export class ApplicationError extends Error {
    statusCode;
    status;
    isOperational;

    constructor(message, statusCode, isOperational = true) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = isOperational;

        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}

// BAD REQUEST ERROR [400]
export class BadRequestError extends ApplicationError {
    details;
    constructor(message = 'Bad Request', details){
        super(message, 400);
        this.details = details;
    }
}

// UNAUTHORIZED ERROR [401]
export class UnauthorizedError extends ApplicationError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

// FORBIDDEN ERROR [403]
export class ForbiddenError extends ApplicationError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}

// NOT FOUND ERROR [404]
export class NotFoundError extends ApplicationError {
    constructor(message = 'Resource Not Found') {
        super(message, 404);
    }
}

// CONFLICT ERROR [409]
export class ConflictError extends ApplicationError {
    constructor(message = 'Conflict: Resource already exists') {
        super(message, 409);
    }
}

// INTERNAL SERVER ERROR [500]
export class InternalServerError extends ApplicationError {
    constructor(message = 'Internal Server Error'){
        super(message, 500);
    }
}