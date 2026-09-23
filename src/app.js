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
import { NotFoundError } from './utils/errors.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';


const app = express();
app.disable('x-powered-by');

// TRUST PROXY CONFIGURATION
if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY.split(',').map(value => value.trim()));

// HELMET SECURITY HEADERS AND CORS CONFIGURATION
app.use(
    helmet({
        // HTTP STRICT TRANSPORT SECURITY (HSTS)
        strictTransportSecurity: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true
        },
        // CONTENT SECURITY POLICY (CSP)
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
        // X-FRAME-OPTIONS HEADER
        xFrameOptions: {
            action: 'deny'
        }
    }),
    cors({ origin: env.CLIENT_URL, credentials: true })
);

// STRIPE WEBHOOK ROUTE + RAW BODY PARSING
app.post('/api/payments/webhook', express.raw(
    { type: 'application/json', limit: '1mb' }
), stripeWebhook);

// HEALTH CHECK ROUTES
app.use(healthRoutes);

// API ROUTES WITH RATE LIMITING AND ORIGIN CHECK
app.use('/api', apiRateLimiter, requireTrustedOrigin);

// JSON PARSING AND COOKIE PARSING
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// HTTP ACCESS LOGGING (MORGAN) AKA WINSTON
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