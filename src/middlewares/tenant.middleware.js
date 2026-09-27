import mongoose from 'mongoose';
import Tenant from '../models/tenant.model.js';
import { NotFoundError } from '../utils/errors.js';


// MIDDLEWARE TO RESOLVE TENANT FROM DEV/HOST HEADER OR QUERY PARAMS
// 1. DEV HEADER / QUERY: x-tenant, x-tenant-id, or ?tenant=slug (POSTMAN & LOCAL TESTING)
// 2. HOST HEADER: SUBDOMAINS (coffee.orbistore.com, coffee.localhost) OR CUSTOM DOMAINS (artisanroast.com)
/**
 * @type {import('express').RequestHandler}
 */
export const resolveTenant = async (req, res, next) => {
    try {
        // 1. DEV / POSTMAN FALLBACK: CHECK EXPLICIT HEADERS || QUERY PARAMS
        const headerTenant = (req.headers['x-tenant'] || req.headers['x-tenant-id'] || req.query?.tenant)?.toString().trim();
        if (headerTenant) {
            const query = mongoose.isValidObjectId(headerTenant)
                ? { _id: headerTenant, isActive: true }
                : { subdomain: headerTenant.toLowerCase(), isActive: true };

            const tenant = await Tenant.findOne(query).lean();
            if (!tenant) {
                return next(new NotFoundError(`Storefront '${headerTenant}' not found or inactive`));
            }

            req.tenant = tenant;
            req.tenantId = tenant._id;
            return next();
        }

        // 2. HOST HEADER RESOLUTION: Strip 'www.' and remove port (e.g., 'coffee.localhost:4400' -> 'coffee.localhost')
        const rawHost = (req.headers.host || '').toLowerCase().replace(/^www\./, '');
        const hostWithoutPort = rawHost.split(':')[0];

        // 3. ROOT PLATFORM & LOCALHOST BYPASS
        const isPlatformRoot = [
            'api.orbistore.com',
            'orbistore.com',
            'localhost',
            '127.0.0.1'
        ].includes(hostWithoutPort);

        if (isPlatformRoot) {
            req.tenant = null;
            req.tenantId = null;
            return next();
        }

        // 4. SUBDOMAIN & CUSTOM DOMAIN LOOKUP?
        // 'coffee.orbistore.com' --> SUBDOMAIN 'coffee'
        // 'coffee.localhost' --> SUBDOMAIN 'coffee'
        const parts = hostWithoutPort.split('.');
        const subdomain = parts[0];

        const tenant = await Tenant.findOne({
            $or: [
                { subdomain: subdomain },
                { customDomain: hostWithoutPort },
                { customDomain: rawHost }
            ],
            isActive: true
        }).lean();

        if (!tenant) {
            return next(new NotFoundError('Storefront not found or is currently inactive'));
        }

        req.tenant = tenant;
        req.tenantId = tenant._id;
        next();
    } catch (error) {
        next(error);
    }
};
