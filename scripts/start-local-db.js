import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { seedDatabase } from '../src/seeds/seed.js';

async function main() {
    console.log('🚀 Starting Orbistore Local MongoDB Replica Set on port 27017...');
    const replSet = await MongoMemoryReplSet.create({
        instanceOpts: [{ port: 27017 }],
        replSet: {
            name: 'rs0',
            count: 1,
            dbName: 'orbistore',
            storageEngine: 'wiredTiger'
        }
    });

    const uri = replSet.getUri('orbistore');
    console.log(`\n✅ Local MongoDB Replica Set is ready!`);
    console.log(`📍 Connection URI: ${uri}\n`);

    // Auto-seed initial stores (Grandlatte & Boutique Tea)
    try {
        await seedDatabase(uri);
    } catch (seedErr) {
        console.error('⚠️ Warning: Auto-seed encountered an error:', seedErr.message);
    }

    console.log('\n💡 Local database running. Keep this terminal open or run in background.');
    console.log('💡 You can now start the backend with: npm run dev\n');

    const cleanup = async () => {
        console.log('\n🛑 Stopping MongoDB Replica Set...');
        await replSet.stop();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch((err) => {
    console.error('❌ Failed to start local database:', err);
    process.exit(1);
});
