import type { HydratedDocument, InferSchemaType } from 'mongoose';
import User from '../models/user.model.js';

declare global {
    namespace Express {
        interface Request {
            user?: HydratedDocument<InferSchemaType<typeof User.schema>>;
        }
    }
}
export { };
