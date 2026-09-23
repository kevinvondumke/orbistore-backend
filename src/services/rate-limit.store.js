import RateLimit from '../models/rate-limit.model.js';

export class MongoRateLimitStore {

    // DEFAULTS
    localKeys = false;
    windowMs = 60000;

    // INIT STORE WITH A PREFIX (TO AVOID COLLISIONS) AND A WINDOW (FOR RESET)
    constructor(prefix) { this.prefix = prefix; }
    init(options) { this.windowMs = options.windowMs; }

    // INCREMENT KEY (FOR NEW OR EXISTING REQUESTS) AND RETURN THE UPDATED COUNTER
    async increment(key) {
        const now = new Date();
        const expired = { $lte: [{ $ifNull: ['$resetTime', new Date(0)] }, now] };
        const update = [{
            $set: {
                totalHits: { $cond: [expired, 1, { $add: ['$totalHits', 1] }] },
                resetTime: { $cond: [expired, new Date(now.getTime() + this.windowMs), '$resetTime'] },
            }
        }];
        const filter = { _id: this.prefix + key };

        // CHECK IF RESULT IS AVAILABLE, OR RETRY IF IT FAILS DUE TO A RACE CONDITION (DUPLICATE KEY)
        let result;
        try {
            result = await RateLimit.collection
                .findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after' });
        } catch (error) {
            if (error.code !== 11000) throw error;
            result = await RateLimit.collection
                .findOneAndUpdate(filter, update, { returnDocument: 'after' });
        }
        if (!result) {
            throw new Error('Rate-limit counter unavailable');
        }

        return {
            totalHits: result.totalHits,
            resetTime: result.resetTime
        };
    }

    // DECREMENT KEY (FOR EXPIRED OR CANCELLED REQUESTS)
    async decrement(key) {
        await RateLimit.collection.updateOne({ _id: this.prefix + key }, [
            { $set: { totalHits: { $max: [0, { $subtract: ['$totalHits', 1] }] } } },
        ]);
    }

    // RESET KEY
    async resetKey(key) { await RateLimit.deleteOne({ _id: this.prefix + key }); }
}
