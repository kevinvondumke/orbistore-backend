import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Tenant from '../models/tenant.model.js';
import User from '../models/user.model.js';
import Category from '../models/category.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import RateLimit from '../models/rate-limit.model.js';

dotenv.config();

const DEFAULT_DATABASE_URL = 'mongodb://127.0.0.1:27017/orbistore';

export async function seedDatabase(targetUri) {
    const mongoUri = targetUri || process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
    console.log('🌱 Starting Orbistore Multi-Tenant Database Seeding...');
    console.log(`📡 Connecting to MongoDB at: ${mongoUri.replace(/\/\/.*@/, '//***:***@')}`);

    await mongoose.connect(mongoUri);

    // 1. CLEAN EXISTING COLLECTIONS & SYNC INDEXES
    console.log('🧹 Cleaning previous seed collections...');
    await Promise.all([
        Tenant.deleteMany({}),
        User.deleteMany({}),
        Category.deleteMany({}),
        Product.deleteMany({}),
        Order.deleteMany({}),
        RateLimit.deleteMany({})
    ]);

    await Promise.all([
        Tenant.collection.dropIndexes().catch(() => {}),
        User.collection.dropIndexes().catch(() => {}),
        Category.collection.dropIndexes().catch(() => {}),
        Product.collection.dropIndexes().catch(() => {}),
        Order.collection.dropIndexes().catch(() => {}),
        RateLimit.collection.dropIndexes().catch(() => {})
    ]);

    for (const model of [Tenant, User, Category, Product, Order, RateLimit]) {
        await model.createIndexes();
    }

    const defaultPassword = 'Password123!';

    // 2. CREATE PLATFORM SUPER-ADMIN & GLOBAL SHOPPER
    console.log('👤 Creating Platform Admin and Demo Shopper...');
    await User.create({
        name: 'Platform SuperAdmin',
        email: 'admin@orbistore.com',
        password: defaultPassword,
        role: 'admin'
    });

    const shopperUser = await User.create({
        name: 'Elena Vance',
        email: 'shopper@demo.com',
        password: defaultPassword,
        role: 'shopper',
        address: {
            street: '742 Evergreen Terrace',
            city: 'Springfield',
            state: 'OR',
            zip: '97477',
            country: 'US'
        }
    });

    // 3. CREATE MERCHANT 1 & TENANT 1: GRANDLATTE COFFEE ROASTERS
    console.log('☕ Seeding Tenant 1: Grandlatte Coffee Roasters...');
    const grandlatteOwner = await User.create({
        name: 'Marcus Rivera',
        email: 'marcus@grandlatte.com',
        password: defaultPassword,
        role: 'merchant'
    });

    const grandlatteTenant = await Tenant.create({
        shopName: 'Grandlatte Coffee Roasters',
        subdomain: 'grandlatte',
        customDomain: 'grandlatte.local',
        description: 'Artisanal specialty coffee roaster focusing on ethically sourced single-origins and crafted blends.',
        logoUrl: 'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=300&auto=format&fit=crop',
        ownerId: grandlatteOwner._id,
        plan: 'pro',
        primaryColor: '#78350F',
        isActive: true
    });

    grandlatteOwner.tenantId = grandlatteTenant._id;
    await grandlatteOwner.save();

    // Grandlatte Categories
    const glCatHouseBlends = await Category.create({ tenantId: grandlatteTenant._id, name: 'House Blends', slug: 'house-blends', description: 'Our signature balanced everyday roasts.' });
    const glCatSingleOrigin = await Category.create({ tenantId: grandlatteTenant._id, name: 'Single Origin', slug: 'single-origin', description: 'Distinct micro-lots highlighting origin terroir.' });
    const glCatLimited = await Category.create({ tenantId: grandlatteTenant._id, name: 'Limited Releases', slug: 'limited-releases', description: 'Rare seasonal harvests and experimental processes.' });
    const glCatDecaf = await Category.create({ tenantId: grandlatteTenant._id, name: 'Decaf', slug: 'decaf', description: 'Chemical-free sugarcane and Swiss water decaf roasts.' });
    const glCatGear = await Category.create({ tenantId: grandlatteTenant._id, name: 'Coffee Gear', slug: 'coffee-gear', description: 'Precision drippers, servers, and grinders.' });
    const glCatMerch = await Category.create({ tenantId: grandlatteTenant._id, name: 'Merchandise', slug: 'merchandise', description: 'Apparel and accessories for coffee lovers.' });

    // Grandlatte 20 Seed Products
    const glProducts = await Product.create([
        { tenantId: grandlatteTenant._id, categoryId: glCatHouseBlends._id, sku: 'GL-HB-001', name: 'Grand Blend', slug: 'grand-blend', price: 18.50, compareAtPrice: 20.00, stock: 50, images: ['https://images.unsplash.com/photo-1587734195503-904fca47e0e9?w=600&auto=format&fit=crop'], description: 'Tasting notes: Chocolate / Caramel / Hazelnut. Medium Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatHouseBlends._id, sku: 'GL-HB-002', name: 'Morning Ritual', slug: 'morning-ritual', price: 17.50, stock: 45, images: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop'], description: 'Tasting notes: Milk Chocolate / Brown Sugar / Almond. Medium-Light Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatHouseBlends._id, sku: 'GL-HB-003', name: 'Espresso No. 1', slug: 'espresso-no-1', price: 19.00, stock: 40, images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop'], description: 'Tasting notes: Dark Chocolate / Caramel / Roasted Nuts. Medium-Dark Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatHouseBlends._id, sku: 'GL-HB-004', name: 'Golden Hour', slug: 'golden-hour', price: 18.00, stock: 35, images: ['https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&auto=format&fit=crop'], description: 'Tasting notes: Honey / Apricot / Cocoa. Light-Medium Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatSingleOrigin._id, sku: 'GL-SO-005', name: 'Ethiopia Guji', slug: 'ethiopia-guji', price: 21.00, compareAtPrice: 23.00, stock: 30, images: ['https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=600&auto=format&fit=crop'], description: 'Tasting notes: Blueberry / Jasmine / Cocoa. Natural Process, Light Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatSingleOrigin._id, sku: 'GL-SO-006', name: 'Colombia Huila', slug: 'colombia-huila', price: 19.50, stock: 35, images: ['https://images.unsplash.com/photo-1587734195503-904fca47e0e9?w=600&auto=format&fit=crop'], description: 'Tasting notes: Red Apple / Caramel / Citrus. Washed Process, Light-Medium Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatSingleOrigin._id, sku: 'GL-SO-007', name: 'Brazil Cerrado', slug: 'brazil-cerrado', price: 16.50, stock: 50, images: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop'], description: 'Tasting notes: Chocolate / Hazelnut / Raisin. Natural Process, Medium Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatSingleOrigin._id, sku: 'GL-SO-008', name: 'Guatemala Antigua', slug: 'guatemala-antigua', price: 18.50, stock: 25, images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop'], description: 'Tasting notes: Cocoa / Brown Sugar / Orange. Washed Process, Medium Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatSingleOrigin._id, sku: 'GL-SO-009', name: 'Costa Rica Tarrazu', slug: 'costa-rica-tarrazu', price: 20.00, stock: 20, images: ['https://images.unsplash.com/photo-1511920170033-f8396924c348?w=600&auto=format&fit=crop'], description: 'Tasting notes: Honey / Stone Fruit / Milk Chocolate. Honey Process, Light-Medium.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatLimited._id, sku: 'GL-LR-010', name: 'Summer Bloom', slug: 'summer-bloom', price: 22.50, compareAtPrice: 25.00, stock: 15, images: ['https://images.unsplash.com/photo-1611854779393-1b2da9d400fe?w=600&auto=format&fit=crop'], description: 'Tasting notes: Blackberry / Hibiscus / Citrus. Kenya Nyeri Washed, Light Roast.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatLimited._id, sku: 'GL-LR-011', name: 'Winter Reserve', slug: 'winter-reserve', price: 22.00, stock: 20, images: ['https://images.unsplash.com/photo-1587734195503-904fca47e0e9?w=600&auto=format&fit=crop'], description: 'Tasting notes: Red Fruit / Cacao / Caramel. Colombia Narino Natural, Medium.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatDecaf._id, sku: 'GL-DC-012', name: 'After Hours Decaf', slug: 'after-hours-decaf', price: 18.00, stock: 30, images: ['https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop'], description: 'Tasting notes: Caramel / Cocoa / Toasted Almond. Sugarcane Decaf, Medium.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatGear._id, sku: 'GL-EQ-013', name: 'GRANDLATTE Ceramic Dripper', slug: 'grandlatte-ceramic-dripper', price: 28.00, stock: 20, images: ['https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop'], description: 'Artisanal ceramic pour-over dripper designed for optimal flow rate.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatGear._id, sku: 'GL-EQ-014', name: 'GRANDLATTE Glass Server', slug: 'grandlatte-glass-server', price: 24.00, stock: 25, images: ['https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop'], description: '600ml heat-resistant borosilicate glass coffee server.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatGear._id, sku: 'GL-EQ-015', name: 'GRANDLATTE Hand Grinder', slug: 'grandlatte-hand-grinder', price: 65.00, compareAtPrice: 75.00, stock: 12, images: ['https://images.unsplash.com/photo-1589396575653-c09c794ff6a6?w=600&auto=format&fit=crop'], description: 'Precision stainless steel conical burr manual coffee grinder.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatGear._id, sku: 'GL-EQ-016', name: 'GRANDLATTE Digital Scale', slug: 'grandlatte-digital-scale', price: 35.00, stock: 18, images: ['https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop'], description: '0.1g precision digital coffee scale with integrated timer.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatGear._id, sku: 'GL-EQ-017', name: 'GRANDLATTE Gooseneck Kettle', slug: 'grandlatte-gooseneck-kettle', price: 55.00, stock: 10, images: ['https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=600&auto=format&fit=crop'], description: '1.0L ergonomic pour-over kettle with balanced precision spout.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatMerch._id, sku: 'GL-AP-018', name: 'GRANDLATTE Everyday Mug', slug: 'grandlatte-everyday-mug', price: 16.00, stock: 40, images: ['https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&auto=format&fit=crop'], description: '12oz ceramic mug with embossed Grandlatte emblem.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatMerch._id, sku: 'GL-AP-019', name: 'GRANDLATTE Canvas Tote', slug: 'grandlatte-canvas-tote', price: 18.00, stock: 50, images: ['https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop'], description: '100% organic cotton heavy-duty canvas tote bag.', isActive: true },
        { tenantId: grandlatteTenant._id, categoryId: glCatMerch._id, sku: 'GL-AP-020', name: 'GRANDLATTE Coffee Club Tee', slug: 'grandlatte-coffee-club-tee', price: 28.00, stock: 30, images: ['https://images.unsplash.com/photo-1589396575653-c09c794ff6a6?w=600&auto=format&fit=crop'], description: 'Vintage washed premium cotton unisex t-shirt.', isActive: true }
    ]);

    // 4. CREATE MERCHANT 2 & TENANT 2: BOUTIQUE TEA CO.
    console.log('🍵 Seeding Tenant 2: Boutique Tea Co...');
    const teaOwner = await User.create({
        name: 'Chloe Zhang',
        email: 'chloe@boutiquetea.com',
        password: defaultPassword,
        role: 'merchant'
    });

    const teaTenant = await Tenant.create({
        shopName: 'Boutique Tea Co.',
        subdomain: 'tea',
        customDomain: 'boutiquetea.local',
        description: 'Purveyors of organic ceremonial matcha, single-estate loose leaves, and handcrafted artisan teaware.',
        logoUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=300&auto=format&fit=crop',
        ownerId: teaOwner._id,
        plan: 'pro',
        primaryColor: '#065F46',
        isActive: true
    });

    teaOwner.tenantId = teaTenant._id;
    await teaOwner.save();

    // Boutique Tea Categories
    const teaCatMatcha = await Category.create({ tenantId: teaTenant._id, name: 'Matcha & Green', slug: 'matcha-green', description: 'Ceremonial grade Uji matcha and shade-grown sencha.' });
    const teaCatBlack = await Category.create({ tenantId: teaTenant._id, name: 'Black & Oolong', slug: 'black-oolong', description: 'Full-bodied black teas and floral high-mountain oolongs.' });
    const teaCatHerbal = await Category.create({ tenantId: teaTenant._id, name: 'Herbal Infusions', slug: 'herbal-infusions', description: 'Caffeine-free botanicals, tisanes, and chamomile blends.' });
    const teaCatWare = await Category.create({ tenantId: teaTenant._id, name: 'Teaware & Accessories', slug: 'teaware-accessories', description: 'Authentic clay pots, bamboo whisks, and double-walled glasses.' });

    // Boutique Tea 8 Seed Products
    const teaProducts = await Product.create([
        { tenantId: teaTenant._id, categoryId: teaCatMatcha._id, sku: 'TEA-MTC-001', name: 'Uji Ceremonial Matcha', slug: 'uji-ceremonial-matcha', price: 32.00, compareAtPrice: 36.00, stock: 30, images: ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop'], description: 'First harvest stone-ground ceremonial matcha from Uji, Kyoto. Vibrant green with sweet umami notes.', isActive: true },
        { tenantId: teaTenant._id, categoryId: teaCatMatcha._id, sku: 'TEA-SNC-002', name: 'Kyoto Organic Sencha', slug: 'kyoto-organic-sencha', price: 18.00, stock: 40, images: ['https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600&auto=format&fit=crop'], description: 'Steamed whole-leaf green tea with crisp vegetal aroma and refreshing finish.', isActive: true },
        { tenantId: teaTenant._id, categoryId: teaCatBlack._id, sku: 'TEA-JAS-003', name: 'Jasmine Dragon Pearls', slug: 'jasmine-dragon-pearls', price: 24.00, stock: 25, images: ['https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600&auto=format&fit=crop'], description: 'Hand-rolled green tea pearls infused with night-blooming fresh jasmine flowers.', isActive: true },
        { tenantId: teaTenant._id, categoryId: teaCatBlack._id, sku: 'TEA-EGL-004', name: 'Earl Grey Imperial', slug: 'earl-grey-imperial', price: 16.50, stock: 50, images: ['https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=600&auto=format&fit=crop'], description: 'High-grown Ceylon black tea blended with pure Italian bergamot oil and cornflowers.', isActive: true },
        { tenantId: teaTenant._id, categoryId: teaCatBlack._id, sku: 'TEA-YUN-005', name: 'Golden Yunnan Black', slug: 'golden-yunnan-black', price: 19.00, stock: 35, images: ['https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop'], description: 'Dianhong black tea with abundant golden tips, offering honey and malt tasting notes.', isActive: true },
        { tenantId: teaTenant._id, categoryId: teaCatHerbal._id, sku: 'TEA-CHM-006', name: 'Chamomile Blossom Blend', slug: 'chamomile-blossom-blend', price: 14.00, stock: 45, images: ['https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=600&auto=format&fit=crop'], description: 'Soothing whole chamomile flowers, lavender buds, and lemongrass. 100% caffeine-free.', isActive: true },
        { tenantId: teaTenant._id, categoryId: teaCatWare._id, sku: 'TEA-POT-007', name: 'Cast Iron Tetsubin Teapot', slug: 'cast-iron-tetsubin-teapot', price: 58.00, compareAtPrice: 65.00, stock: 15, images: ['https://images.unsplash.com/photo-1597481499750-3e6b22637e12?w=600&auto=format&fit=crop'], description: 'Traditional 800ml enameled cast iron teapot with stainless steel infuser.', isActive: true },
        { tenantId: teaTenant._id, categoryId: teaCatWare._id, sku: 'TEA-WHS-008', name: 'Bamboo Matcha Whisk (Chasen)', slug: 'bamboo-matcha-whisk', price: 18.00, stock: 40, images: ['https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=600&auto=format&fit=crop'], description: '100-prong handcrafted golden bamboo whisk for creating creamy, frothy matcha.', isActive: true }
    ]);

    // 5. CREATE SAMPLE PAID ORDERS
    console.log('📦 Creating Sample Paid Orders...');
    await Order.create({
        tenantId: grandlatteTenant._id,
        userId: shopperUser._id,
        user: shopperUser._id,
        orderNumber: 'ORB-GL-1001',
        items: [
            { productId: glProducts[0]._id, product: glProducts[0]._id, name: glProducts[0].name, price: glProducts[0].price, priceMinor: 1850, quantity: 2, image: glProducts[0].images[0] },
            { productId: glProducts[4]._id, product: glProducts[4]._id, name: glProducts[4].name, price: glProducts[4].price, priceMinor: 2100, quantity: 1, image: glProducts[4].images[0] }
        ],
        total: 58.00,
        totalMinor: 5800,
        currency: 'USD',
        pricingVersion: 1,
        paymentStatus: 'paid',
        paymentIntentId: 'pi_test_grandlatte_1001',
        shippingAddress: shopperUser.address
    });

    await Order.create({
        tenantId: teaTenant._id,
        userId: shopperUser._id,
        user: shopperUser._id,
        orderNumber: 'ORB-TEA-2001',
        items: [
            { productId: teaProducts[0]._id, product: teaProducts[0]._id, name: teaProducts[0].name, price: teaProducts[0].price, priceMinor: 3200, quantity: 1, image: teaProducts[0].images[0] },
            { productId: teaProducts[7]._id, product: teaProducts[7]._id, name: teaProducts[7].name, price: teaProducts[7].price, priceMinor: 1800, quantity: 1, image: teaProducts[7].images[0] }
        ],
        total: 50.00,
        totalMinor: 5000,
        currency: 'USD',
        pricingVersion: 1,
        paymentStatus: 'paid',
        paymentIntentId: 'pi_test_tea_2001',
        shippingAddress: shopperUser.address
    });

    console.log('\n======================================================');
    console.log('✅ SEEDING COMPLETE! TEST CREDENTIALS:');
    console.log('======================================================');
    console.log('👑 SuperAdmin:     admin@orbistore.com    | Password123!');
    console.log('☕ Grandlatte:     marcus@grandlatte.com  | Password123! (Subdomain: grandlatte)');
    console.log('🍵 Boutique Tea:   chloe@boutiquetea.com  | Password123! (Subdomain: tea)');
    console.log('🛍️ Shopper:        shopper@demo.com       | Password123!');
    console.log('======================================================\n');

    await mongoose.disconnect();
}

// Execute if run directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
    seedDatabase().catch((err) => {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    });
}
