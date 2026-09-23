import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import User from '../src/models/user.model.js';

try {
    await mongoose.connect(env.DATABASE_URL, { autoIndex: false });
    const duplicates = await User.aggregate([
        { $group: { _id: { $toLower: { $trim: { input: '$email' } } }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
    ]);
    if (duplicates.length) throw new Error('Duplicate normalized emails found in ' + duplicates.length + ' groups. Resolve ownership manually; no users were changed.');
    if (process.argv.includes('--apply')) {
        const result = await User.collection.updateMany({}, [{ $set: { email: { $toLower: { $trim: { input: '$email' } } } } }]);
        await User.createIndexes();
        console.log('Normalized users: ' + result.modifiedCount + '; unique index ensured.');
    } else {
        console.log('No normalized duplicates found. Re-run with --apply during maintenance to normalize emails and ensure the unique index.');
    }
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
