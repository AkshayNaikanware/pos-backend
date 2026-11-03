import 'dotenv/config';

// Tests always run against their own database, never the dev one.
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'pos_test';
process.env.DB_LOGGING = 'false';
process.env.TAX_RATE_PERCENT = '5';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret';
// Redis is optional; the suite runs (and passes) without it.
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? '';
