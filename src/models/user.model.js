import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 40
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        select: false
    },

    // MULTI-TENANT ROLES
    role: {
        type: String,
        enum: ['shopper', 'merchant', 'admin'],
        default: 'shopper'
    },
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        default: null
    },
    tenantRole: {
        type: String,
        enum: ['owner', 'manager', 'staff'],
        default: null
    },

    // ADDITIONAL INFORMATION
    address: {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: String
    },
    avatarUrl: String,
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// PASSWORD HASHING HOOK
userSchema.pre(
    'save',
    /** @this {import('mongoose').HydratedDocument<import('mongoose').InferSchemaType<typeof userSchema>>} */
    async function () {
        if (!this.isModified('password')) return;

        this.password = await bcrypt.hash(this.password, 10);
    }
);

// INDEXES
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ tenantId: 1 });

export default mongoose.model('User', userSchema);
