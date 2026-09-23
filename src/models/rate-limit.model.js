import mongoose from 'mongoose';
const schema = new mongoose.Schema({
    _id: String, totalHits: Number, resetTime: Date,
});
schema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('RateLimit', schema);
