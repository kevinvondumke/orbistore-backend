import mongoose from 'mongoose';
const itemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1, max: 1000, validate: Number.isSafeInteger },
    price: { type: Number, required: true, min: 0 },
    priceMinor: { type: Number, required: true, min: 0, max: 99_999_999, validate: Number.isSafeInteger },
});
const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [itemSchema], required: true, validate: value => value.length > 0 && value.length <= 100 },
    total: { type: Number, required: true, min: 0.5 },
    totalMinor: { type: Number, required: true, min: 50, max: 99_999_999, validate: Number.isSafeInteger },
    currency: { type: String, required: true, enum: ['usd'] },
    // Deliberately no default for legacy records.
    pricingVersion: { type: Number, required: true, enum: [1] },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'canceling', 'canceled'], default: 'pending' },
    fulfillmentStatus: { type: String, enum: ['unfulfilled', 'processing', 'shipped', 'delivered'], default: 'unfulfilled' },
    paymentIntentId: { type: String, default: null },
    paymentAttemptAt: Date,
    reservationExpiresAt: Date,
    stockReleasedAt: Date,
}, { timestamps: true });
orderSchema.index({ paymentIntentId: 1 }, { unique: true, partialFilterExpression: { paymentIntentId: { $type: 'string' } } });
orderSchema.index({ paymentStatus: 1, reservationExpiresAt: 1 });
orderSchema.pre('validate', function () {
    const sum = this.items.reduce((total, item) => total + item.priceMinor * item.quantity, 0);
    if (!Number.isSafeInteger(sum) || sum !== this.totalMinor || this.total !== sum / 100) {
        this.invalidate('totalMinor', 'Order totals must equal the item amounts');
    }
});
export default mongoose.model('Order', orderSchema);
