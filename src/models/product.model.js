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
    compareAtPrice: {
        type: Number,
        default: null
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
        default: true
    }
}, { timestamps: true });

// INDEXES
productSchema.index(
    { tenantId: 1, slug: 1 },
    { unique: true }
);
productSchema.index(
    { tenantId: 1, isActive: 1, price: 1 }
);

export default mongoose.model('Product', productSchema);