import mongoose from 'mongoose';
import { env } from './env.js';
import User from '../models/user.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import RateLimit from '../models/rate-limit.model.js';

// VERIFY USER EMAILS
export async function verifyUserEmails() {
    const duplicates = await User.aggregate([
        { $group: { _id: { $toLower: { $trim: { input: '$email' } } }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }, { $limit: 1 },
    ]);

    if (duplicates.length) {
        throw new Error('Duplicate normalized user emails exist. Resolve duplicates before startup; no records were changed.');
    }

    const unnormalized = await User.collection.findOne(
        {
            $expr: {
                $ne: ['$email', { $toLower: { $trim: { input: '$email' } } }]
            },
        },
        {
            projection: { _id: 1 }
        }
    );

    if (unnormalized) {
        throw new Error('Legacy emails need normalization. Run the documented email migration before startup.');
    }
}

// CONNECT TO MONGODB AND VERIFY REPLICA SET OR SHARDED CLUSTER
export default async function connectDB() {
    await mongoose.connect(
        env.DATABASE_URL,
        {
            autoIndex: false,
            serverSelectionTimeoutMS: 10000
        }
    );

    // VERIFY REPLICA SET OR SHARDED CLUSTER
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
        throw new Error('Checkout requires a MongoDB replica set or sharded cluster');
    }

    await verifyUserEmails();

    // CREATE COLLECTIONS AND INDEXES FOR ALL MODELS
    for (const model of [User, Product, Order, RateLimit]) {
        await model.createCollection();
        await model.createIndexes();
    }
}
