import mongoose from 'mongoose';
import { dollarsToMinor } from '../utils/money.js';

const productSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    slug: {
        type: String,
        required: true
    },
    sku: {
        type: String
    },
    description: String,
    price: {
        type: Number,
        required: true,
        min: 0,
        validate: value => {
            try {
                dollarsToMinor(value);
                return true;
            } catch {
                return false;
            }
        }
    },
    compareAtPrice: Number,
    currency: {
        type: String,
        default: 'USD',
        uppercase: true
    },
    pricingVersion: {
        type: Number,
        default: 1
    },
    stock: {
        type: Number,
        default: 0,
        min: 0,
        max: 1_000_000,
        validate: Number.isSafeInteger
    },
    images: [{ type: String }],
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    tags: [String],
}, { timestamps: true });

// INDEXES
productSchema.index(
    { tenantId: 1, slug: 1 },
    { unique: true }
);
productSchema.index(
    { tenantId: 1, sku: 1 },
    { unique: true, partialFilterExpression: { sku: { $type: 'string' } } }
);
productSchema.index(
    { tenantId: 1, isActive: 1, price: 1 }
);
productSchema.index(
    { tenantId: 1, name: 'text', description: 'text' }
);

export default mongoose.model('Product', productSchema);