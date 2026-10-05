import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import healthRoutes from './routes/health.js';
import { stripeWebhook } from './controllers/payment.controller.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { apiRateLimiter } from './middlewares/rate-limit.js';
import { requireTrustedOrigin } from './middlewares/origin.js';
import { resolveTenant } from './middlewares/tenant.middleware.js';
import { NotFoundError } from './utils/errors.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = express();
app.disable('x-powered-by');

// TRUST PROXY CONFIGURATION
if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY.split(',').map(value => value.trim()));

// HELMET SECURITY HEADERS
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            'defaultSrc': ["'self'"],
            'scriptSrc': ["'self'", "https://trusted-cdn.com", "https://js.stripe.com"],
            'styleSrc': ["'self'", "'unsafe-inline'"],
            'upgrade-insecure-requests': [],
            'block-all-mixed-content': []
        }
    },
    xFrameOptions: {
        action: 'deny'
    }
}));

// CORS CONFIGURATION (Allows configured CLIENT_URL, Postman/curl, and dev multi-tenant subdomains)
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin === env.CLIENT_URL || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            return callback(null, true);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant', 'x-tenant-id']
}));

// STRIPE WEBHOOK ROUTE + RAW BODY PARSING
app.post('/api/payments/webhook', express.raw(
    { type: 'application/json', limit: '1mb' }
), stripeWebhook);

// HEALTH CHECK ROUTES
app.use(healthRoutes);

// JSON PARSING AND COOKIE PARSING
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// MULTI-TENANT RESOLUTION (Resolves tenant via x-tenant / x-tenant-id header or host subdomain)
app.use(resolveTenant);

// API ROUTES WITH RATE LIMITING AND ORIGIN CHECK
app.use('/api', apiRateLimiter, requireTrustedOrigin);

// HTTP ACCESS LOGGING (MORGAN)
if (env.NODE_ENV !== 'test') {
    const morganFormat = env.NODE_ENV === 'production' ? 'combined' : 'dev';
    app.use(morgan(
        morganFormat,
        {
            stream: { write: (message) => logger.http(message.trim()) }
        }
    ));
}

// REGISTER ROUTES
registerRoutes(app);

// ERROR HANDLING
app.use((req, res, next) => next(new NotFoundError('Route not found')));
app.use(errorHandler);

export default app;
