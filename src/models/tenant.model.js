import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema({

    // IDENTITY
    shopName: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 40
    },
    subdomain: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        minLength: 3,
        maxLength: 15
    },
    customDomain: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true,
        match: /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
        minLength: 3,
        maxLength: 40
    },
    description: { type: String },
    logoUrl: { type: String },

    // STORE OWNER
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // BILLING AND PLAN
    plan: {
        type: String,
        enum: ['free', 'premium'],
        default: 'free'
    },    
    commissionRate: {
        type: Number,
        default: 0.02,
    },

    // STRIPE ACCOUNT
    stripeAccountId: {
        type: String,
        default: null
    },

    // BRANDING AND CUSTOMIZATION
    primaryColor: {
        type: String,
        default: '#2563eb'
    },
    accentColor: {
        type: String,
        default: '#ffffff'
    },

    // STATUS
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// INDEXES
tenantSchema.index(
    { subdomain: 1 },
    { unique: true }
);
tenantSchema.index(
    { customDomain: 1 },
    { unique: true, sparse: true }
);
tenantSchema.index(
    { ownerId: 1 }
);
tenantSchema.index(
    { isActive: 1 }
);

export default mongoose.model('Tenant', tenantSchema);