import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { createPaymentIntent } from '../controllers/payment.controller.js';
import { validateRequest } from '../middlewares/validate.js';
import { createPaymentSchema } from '../schemas/order.schema.js';

const router = express.Router();

router.post('/create-intent', authenticate, validateRequest(createPaymentSchema), createPaymentIntent);

export default router;
