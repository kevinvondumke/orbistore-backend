import type { HydratedDocument, InferSchemaType, Types } from 'mongoose';
import User from '../models/user.model.js';
import Tenant from '../models/tenant.model.js';

declare global {
    namespace Express {
        interface Request {
            user?: HydratedDocument<InferSchemaType<typeof User.schema>>;
            tenantId?: Types.ObjectId | null;
            tenant?: InferSchemaType<typeof Tenant.schema> & { _id: Types.ObjectId };
        }
    }
}
export { };
