import { Router } from 'express';
import { getLiveness, getReadiness } from '../middlewares/health.controller.js';

const router = Router();

// LIVENESS PROBE (GET /health)
router.get('/health', getLiveness);

// READINESS PROBE (GET /ready)
router.get('/ready', getReadiness);

export default router;