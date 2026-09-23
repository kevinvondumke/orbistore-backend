import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true });
export default mongoose.model('User', userSchema);
