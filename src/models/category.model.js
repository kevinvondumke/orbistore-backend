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
    description: String
}, { timestamps: true });

// INDEXES
categorySchema.index(
    { tenantId: 1, slug: 1 },
    { unique: true }
);

export default mongoose.model('Category', categorySchema);