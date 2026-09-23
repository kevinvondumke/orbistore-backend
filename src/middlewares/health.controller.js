import mongoose from 'mongoose';

// GET LIVENESS PROBE (GET /health)
/** @type {import('express').RequestHandler} */
export function getLiveness(req, res) {
    return res.status(200).json({ 
        message: 'SERVER ACTIVE AND RUNNING',
        status: 'OK', 
        timestamp: new Date().toISOString(), 
        uptime: process.uptime() 
    });
}

// GET READINESS PROBE (GET /ready)
/** @type {import('express').RequestHandler} */
export function getReadiness(req, res) {
    const connected = mongoose.connection.readyState === 1;
    return res.status(connected ? 200 : 503).json({
        status: connected ? 'OK' : 'Error', 
        timestamp: new Date().toISOString(),
        database: connected ? 'CONNECTED' : 'DISCONNECTED',
    });
}
