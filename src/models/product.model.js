import mongoose from 'mongoose';
import { dollarsToMinor } from '../utils/money.js';

const productSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 10000 },
    price: { type: Number, required: true, min: 0, validate: value => {
        try { dollarsToMinor(value); return true; } catch { return false; }
    } },
    category: { type: String, maxlength: 100 },
    stock: { type: Number, default: 0, min: 0, max: 1_000_000, validate: Number.isSafeInteger },
    images: [String],
}, { timestamps: true });
export default mongoose.model('Product', productSchema);
