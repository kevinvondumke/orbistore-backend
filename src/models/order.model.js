import mongoose from 'mongoose';


const orderSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    totalMinor: { 
        type: Number, 
        required: true 
    },
    platformFee: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD',
        required: true,
        uppercase: true,
        match: /^[A-Z]{3}$/
    },
    pricingVersion: {
        type: Number,
        default: 1
    },

    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: String,
        price: Number,
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        image: String
    }],
    totalAmount: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'canceled', 'refunded'],
        default: 'pending'
    },
    paymentIntentId: {
        type: String,
        index: true
    },
    paymentAttemptAt: {
        type: Date,
        default: null
    },
    shippingAddress: {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    }
}, { timestamps: true });

// INDEXES
orderSchema.index({ tenantId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);