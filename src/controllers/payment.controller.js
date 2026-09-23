import { stripe } from '../services/stripe.service.js';
import { env } from '../config/env.js';
import { createOrderPayment } from '../services/payment.service.js';
import { applyPaymentEvent } from '../services/webhook.service.js';
import { BadRequestError } from '../utils/errors.js';

// CREATE PAYMENT INTENT FOR ORDER (USER ONLY) + STRIPE WEBHOOK
/** @type {import('express').RequestHandler} */
export const createPaymentIntent = async (req, res, next) => {
    try { 
        return res.json(
            await createOrderPayment(req.body.orderId, req.user._id, stripe)
        ); 
    } catch (error) { 
        next(error); 
    }
};

// STRIPE WEBHOOK FOR PAYMENT EVENTS (STRIPE ONLY) + APPLY PAYMENT STATUS
/** @type {import('express').RequestHandler} */
export const stripeWebhook = async (req, res, next) => {
    let event;
    try {
        event = stripe.webhooks.constructEvent(
            req.body, 
            req.get('stripe-signature'), 
            env.STRIPE_WEBHOOK_SECRET
        );
    } catch {
        return next(new BadRequestError('Invalid webhook signature'));
    }
    try {
        await applyPaymentEvent(event);
        return res.json({ received: true });
    } catch (error) {
        // A non-2xx response makes Stripe retry. Never acknowledge a lost DB update.
        next(error);
    }
};
