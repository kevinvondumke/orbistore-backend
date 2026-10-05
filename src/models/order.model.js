import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: false,
        default: null,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
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
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product'
        },
        name: String,
        price: Number,
        priceMinor: Number,
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        image: String
    }],

    total: {
        type: Number,
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'canceled', 'canceling', 'refunded'],
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
    reservationExpiresAt: {
        type: Date,
        default: null
    },
    stockReleasedAt: {
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

// SYNCHRONIZE total, totalMinor AND item fields
orderSchema.pre('validate', function () {
    // Synchronize order totals
    if (this.total != null && this.totalMinor == null) {
        this.totalMinor = Math.round(this.total * 100);
    } else if (this.totalMinor != null && this.total == null) {
        this.total = this.totalMinor / 100;
    }

    // Synchronize user fields
    if (this.userId && !this.user) {
        this.user = this.userId;
    } else if (this.user && !this.userId) {
        this.userId = this.user;
    }

    // Synchronize item fields
    if (Array.isArray(this.items)) {
        for (const item of this.items) {
            if (item.productId && !item.product) {
                item.product = item.productId;
            } else if (item.product && !item.productId) {
                item.productId = item.product;
            }
            if (item.price != null && item.priceMinor == null) {
                item.priceMinor = Math.round(item.price * 100);
            } else if (item.priceMinor != null && item.price == null) {
                item.price = item.priceMinor / 100;
            }
        }
    }
});

// INDEXES
orderSchema.index({ tenantId: 1, createdAt: -1 });
orderSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);