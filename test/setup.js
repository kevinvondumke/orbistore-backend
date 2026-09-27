// Synthetic local-only values; imports never connect to MongoDB or Stripe.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mongodb://127.0.0.1:27017/orbistore_test';
process.env.JWT_SECRET = 'test-only-secret-at-least-32-characters';
process.env.CLIENT_URL = 'http://localhost:5100';
process.env.STRIPE_SECRET_KEY = 'sk_test_local_placeholder';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_local_placeholder';
process.env.RATE_LIMIT_STORE = 'memory';
process.env.COOKIE_SAME_SITE = 'lax';
process.env.TRUST_PROXY = '';
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud_name';
process.env.CLOUDINARY_API_KEY = 'test-api-key';
process.env.CLOUDINARY_API_SECRET = 'test_api_secret';