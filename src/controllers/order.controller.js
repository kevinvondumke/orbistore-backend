import Order from '../models/order.model.js';
import { createPricedOrder } from '../services/order.service.js';
import { cancelReservedOrder } from '../services/reservation.service.js';
import { stripe } from '../services/stripe.service.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';

// CREATE ORDER AND RESERVE ITEMS (USER ONLY) + PAYMENT INTENT
/** @type {import('express').RequestHandler} */
export const createOrder = async (req, res, next) => {
    try {
        const order = await createPricedOrder(req.user._id, req.body.items);
        return res.status(201).json(order);
    } catch (error) {
        next(error);
    }
};

// GET ALL ORDERS (ADMIN ONLY) + PAGINATION
/** @type {import('express').RequestHandler} */
export const getUserOrders = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = res.locals.query || {};
        const query = {
            $or: [{ userId: req.user._id }, { user: req.user._id }]
        };

        if (req.tenantId) {
            query.tenantId = req.tenantId;
        }

        const orders = await Order
            .find(query)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return res.json(orders);
    } catch (error) {
        next(error);
    }
};

// GET ALL ORDERS (ADMIN ONLY) AND UPDATE ORDER STATUS (ADMIN ONLY)
/** @type {import('express').RequestHandler} */
export const getAllOrders = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = res.locals.query || {};

        // SCOPE TO TENNAT FOR MERCHANTS || SUPER ADMIN SEES ALL
        const query = {};
        if (req.user.role === 'merchant') {
            query.tenantId = req.tenantId || req.user.tenantId;
        } else if (req.tenantId) {
            query.tenantId = req.tenantId;
        }

        const orders = await Order
            .find(query)
            .populate('userId', 'name email')
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        return res.json(orders);
    } catch (error) {
        next(error);
    }
};

// UPDATE ORDER STATUS (ADMIN ONLY) AND CANCEL ORDER (USER OR ADMIN)
/** @type {import('express').RequestHandler} */
export const updateOrderStatus = async (req, res, next) => {
    try {
        // DEFINE PREVIOUS STATUS FOR VALID TRANSITIONS
        const previous = {
            processing: 'unfulfilled',
            shipped: 'processing',
            delivered: 'shipped'
        };

        const query = /** @type {any} */ ({
            _id: req.params.id,
            paymentStatus: 'paid',
            fulfillmentStatus: previous[req.body.fulfillmentStatus],
        });

        if (req.user.role !== 'admin') {
            query.tenantId = req.tenantId || req.user.tenantId;
        }

        // UPDATE ORDER STATUS IF VALID TRANSITION AND PAID
        const order = await Order.findOneAndUpdate(
            query,
            { $set: { fulfillmentStatus: req.body.fulfillmentStatus } },
            { returnDocument: 'after', runValidators: true }
        );

        if (!order) {
            const current = await Order.findById(req.params.id);
            if (!current) throw new NotFoundError('Order not found');
            if (current.paymentStatus === 'paid') return res.json(current);

            throw new ConflictError('Invalid fulfillment transition or unpaid order');
        }

        return res.json(order);
    } catch (error) {
        next(error);
    }
};

// CANCEL ORDER (USER OR ADMIN) AND RELEASE RESERVED ITEMS
/** @type {import('express').RequestHandler} */
export const cancelOrder = async (req, res, next) => {
    try {
        return res.json(
            await cancelReservedOrder(req.params.id, req.user._id, stripe)
        );
    } catch (error) {
        next(error);
    }
};
