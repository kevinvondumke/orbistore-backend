import http from 'node:http';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';
import { stripe } from './services/stripe.service.js';
import { expireReservations } from './services/reservation.service.js';
import { logger } from './config/logger.js';

// START SERVER AND RESERVATION EXPIRY WORKER
const server = http.createServer(app);
let timer;
let expiryRun = Promise.resolve();
let expiryRunning = false;
let stopping = false;

// SHUTDOWN SERVER AND CLEANUP
async function shutdown(exitCode = 0) {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    const force = setTimeout(() => { server.closeAllConnections(); process.exit(1); }, 30000);
    force.unref();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await expiryRun;
    await mongoose.disconnect();
    clearTimeout(force);
    process.exitCode = exitCode;
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });

// GLOBAL PROCESS GUARDS
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
    void shutdown(1);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    void shutdown(1);
});

// HANDLE SERVER ERRORS
server.on('error', error => {
    logger.error('HTTP server failed', {
        error: error.message,
        stack: error.stack
    });
    void shutdown(1);
});

// STARTUP
try {
    await connectDB();

    if (stopping) {
        await mongoose.disconnect();
    }

    if (!stopping) {

        // START SERVER
        server.listen(
            env.PORT,
            () => logger.info(`ORBISTORE BACKEND RUNNING ON PORT ${env.PORT} IN ${env.NODE_ENV} MODE`)
        );

        // START RESERVATION EXPIRY
        timer = setInterval(() => {
            if (expiryRunning || stopping) return;
            expiryRunning = true;

            expiryRun = expireReservations(stripe)
                .catch(error => {
                    logger.error('Reservation worker failed', {
                        error: error.message,
                        stack: error.stack
                    });
                })
                .finally(
                    () => { expiryRunning = false; }
                );
        }, 60000);
        timer.unref();
    }
} catch (error) {
    logger.error('Startup failed', {
        error: error.message,
        stack: error.stack
    });
    await shutdown(1);
}
