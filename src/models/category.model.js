import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true
    },
    description: String,
    imageUrl: String,
    parentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    sortOrder: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// INDEXES
categorySchema.index(
    { tenantId: 1, slug: 1 },
    { unique: true }
);

export default mongoose.model('Category', categorySchema);