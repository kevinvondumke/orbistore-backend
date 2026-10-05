import Order from '../models/order.model.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { MIN_PAYMENT_MINOR, MAX_PAYMENT_MINOR } from '../utils/money.js';

// GET TRUSTED ORDER AMOUNT AND ENSURE IT MATCHES THE ORDER ITEMS
export function getTrustedAmount(order) {
    const currency = (order.currency || '').toLowerCase();

    // ENSURE THAT THE ORDER HAS TRUSTED PRICING AND VALID ITEMS
    if (order.pricingVersion !== 1 || currency !== 'usd' ||
        !Number.isSafeInteger(order.totalMinor) || order.totalMinor < MIN_PAYMENT_MINOR ||
        order.totalMinor > MAX_PAYMENT_MINOR || !order.items?.length) {
        throw new ConflictError('Order has no trusted pricing; please create a new order');
    }

    // FOR EACH ITEM, ENSURE THAT THE PRICE AND QUANTITY ARE VALID AND SUM THEM UP
    let sum = 0;
    for (const item of order.items) {
        const itemPriceMinor = item.priceMinor ?? (item.price != null ? Math.round(item.price * 100) : null);
        if (!Number.isSafeInteger(itemPriceMinor) || itemPriceMinor < 0 ||
            !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) {
            throw new ConflictError('Invalid order pricing');
        }
        sum += itemPriceMinor * item.quantity;
    }
    
    // ENSURE THAT THE SUM OF THE ITEMS MATCHES THE ORDER TOTAL
    if (!Number.isSafeInteger(sum) || sum !== order.totalMinor) {
        throw new ConflictError('Order total does not match its items');
    }
    
    return sum;
}

// CREATE ORDER PAYMENT INTENT (USER ONLY) AND ENSURE IT MATCHES THE ORDER
export async function createOrderPayment(orderId, userId, stripe) {
    
    // FIND THE ORDER AND ENSURE IT IS PAYABLE
    let order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
        throw new NotFoundError('Order not found');
    }
    if (!['pending', 'failed'].includes(order.paymentStatus)) {
        throw new ConflictError('Order is not payable');
    }
    if (order.reservationExpiresAt && order.reservationExpiresAt <= new Date()) {
        throw new ConflictError('Order reservation expired');
    }
    
    // FIND AND UPDATE THE ORDER TO PERSIST THE PAYMENT ATTEMPT, OR RELOAD IT IF IT CHANGED
    const amount = getTrustedAmount(order);
    const currency = (order.currency || 'usd').toLowerCase();

    if (!order.paymentIntentId) {        
        order = await Order.findOneAndUpdate(
            {
                _id: order._id, 
                paymentStatus: { $in: ['pending', 'failed'] },
                paymentAttemptAt: null, paymentIntentId: null,
            }, 
            { 
                $set: { paymentAttemptAt: new Date() } 
            }, 
            { returnDocument: 'after' }
        ) || await Order.findById(order._id);
        
        // CHECK IF THE ORDER IS STILL PAYABLE AFTER PERSISTING THE ATTEMPT 
        if (!order || !['pending', 'failed'].includes(order.paymentStatus)) {
            throw new ConflictError('Order is not payable');
        }
        
        // CHECK IF THE PAYMENT ATTEMPT IS TOO OLD (24 HOURS) AND NEEDS RECONCILIATION
        if (
            !order.paymentIntentId && 
            (!order.paymentAttemptAt || Date.now() - order.paymentAttemptAt.getTime() > 23 * 3600000)) {
            throw new ConflictError('Payment attempt needs reconciliation; contact support');
        }
    }

    // CREATE OR RETRIEVE PAYMENT INTENT || ENSURING IT MATCHES THE ORDER
    const intent = order.paymentIntentId
        ? await stripe.paymentIntents.retrieve(order.paymentIntentId)
        : await stripe.paymentIntents.create({
            amount, currency, metadata: { orderId: String(order._id) },
        }, { idempotencyKey: 'order:' + order._id + ':pricing:1' });
    if (
        intent.amount !== amount || 
        intent.currency.toLowerCase() !== currency ||
        ['canceled', 'succeeded'].includes(intent.status)) {
            throw new ConflictError('Payment does not match a payable order');    
        }
    
    // ENSURE THAT THE PAYMENT INTENT IS LINKED TO THE ORDER, AND THAT THE ORDER IS STILL PAYABLE
    const linked = await Order.findOneAndUpdate({
        _id: order._id, 
        paymentStatus: { $in: ['pending', 'failed'] },
        $or: [{ paymentIntentId: null }, { paymentIntentId: intent.id }],
    }, { $set: { paymentIntentId: intent.id } }, { returnDocument: 'after' });
    if (!linked) {
        throw new ConflictError('Order changed during payment creation');
    }
    
    return { 
        clientSecret: intent.client_secret, 
        paymentIntentId: intent.id 
    };
}
