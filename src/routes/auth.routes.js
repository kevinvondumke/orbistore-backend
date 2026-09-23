import { Router } from 'express';
import { register, login, logout } from '../controllers/auth.controller.js';
import { authRateLimiter, registerRateLimiter } from '../middlewares/rate-limit.js';
import { validateRequest } from '../middlewares/validate.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';

const router = Router();

// REGOSTER ROUTE
router.post('/register', registerRateLimiter, validateRequest(registerSchema), register);

// LOGIN ROUTE
router.post('/login', authRateLimiter, validateRequest(loginSchema), login);

// LOGOUT ROUTE
router.post('/logout', logout);

export default router;
