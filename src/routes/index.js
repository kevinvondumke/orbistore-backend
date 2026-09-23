import authRoutes from './auth.routes.js';
import productRoutes from './product.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';

// REGISTER ALL ROUTES
export const registerRoutes = (app) => {
    app.use('/api/auth', authRoutes);
    app.use('/api/products', productRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/payments', paymentRoutes);
}