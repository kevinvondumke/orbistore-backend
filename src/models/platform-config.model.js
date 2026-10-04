import mongoose from 'mongoose';

const platformConfigSchema = new mongoose.Schema({
    commissionRate: {
        type: Number,
        default: 0.02
    },
    premiumPlanPrice: {
        type: Number,
        default: 29
    },
    maintenanceMode: {
        type: Boolean,
        default: false
    },
    allowNewRegistrations: {
        type: Boolean,
        default: true
    },
    featureFlags: {
        customDomainsEnabled: {
            type: Boolean,
            default: true
        },
        stripeConnectEnabled: {
            type: Boolean,
            default: true
        }
    }
}, { timestamps: true });

export default mongoose.model('PlatformConfig', platformConfigSchema);