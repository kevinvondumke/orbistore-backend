import dotenv from 'dotenv';
import { envSchema } from '../schemas/env.schema.js';
export { envSchema } from '../schemas/env.schema.js';

dotenv.config({ quiet: true });

// VALIDATE ENVIRONMENT VARIABLES
const result = envSchema.safeParse(process.env);
if (!result.success) {
    // Report configuration keys, never credential values.
    throw new Error('Invalid configuration: ' + result.error.issues.map(
        issue => issue.path.join('.') + ': ' + issue.message)
        .join('; ')
    );
}
export const env = result.data;
