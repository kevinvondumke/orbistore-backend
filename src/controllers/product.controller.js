import Product from '../models/product.model.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// GET ALL PRODUCTS (PUBLIC) + PAGINATION | (SCOPED TO CURRENT TENANT)
/** @type {import('express').RequestHandler} */
export const getProducts = async (req, res, next) => {
    try {
        const query = { isActive: true };
        if (req.tenantId) {
            query.tenantId = req.tenantId;
        }

        const products = await Product.find(query)
            .populate('categoryId', 'name slug')
            .sort({ createdAt: -1 });

        return res.json(products);
    } catch (error) {
        next(error);
    }
};

// GET SINGLE PRODUCT (PUBLIC)
/** @type {import('express').RequestHandler} */
export const getProduct = async (req, res, next) => {
    try {
        const query = { _id: req.params.id };
        if (req.tenantId) {
            query.tenantId = req.tenantId;
        }

        const product = await Product.findOne(query)
            .populate('categoryId', 'name slug');
        if (!product) throw new NotFoundError('Product not found in this store.');

        return res.json(product);
    } catch (error) {
        next(error);
    }
};

// CREATE PRODUCT (MERCHAN || ADMIN)
/** @type {import('express').RequestHandler} */
export const createProduct = async (req, res, next) => {
    try {
        const tenantId = req.tenantId || req.user?.tenantId || req.body.tenantId;
        if (!tenantId && req.user.role !== 'admin') {
            throw new BadRequestError('Tenant context is required to create products.');
        }

        const product = await Product.create({ ...req.body, tenantId });
        return res.status(201).json(product);
    } catch (error) {
        next(error);
    }
};

// UPDATE PRODUCT (ADMIN ONLY) + VALIDATE ID
/** @type {import('express').RequestHandler} */
export const updateProduct = async (req, res, next) => {
    try {
        const query = { _id: req.params.id };
        if (req.user && req.user.role !== 'admin') {
            query.tenantId = req.tenantId || req.user?.tenantId;
        }

        const product = await Product.findOneAndUpdate(
            query,
            { $set: req.body },
            { returnDocument: 'after', runValidators: true }
        );

        if (!product) throw new NotFoundError('Product not found or unathorized.');
        return res.json(product);
    } catch (error) {
        next(error);
    }
};

// DELETE PRODUCT (ADMIN ONLY) + VALIDATE ID
/** @type {import('express').RequestHandler} */
export const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id)) {
            throw new BadRequestError('Invalid product ID');
        }

        const query = { _id: id };
        if (req.user && req.user.role !== 'admin') {
            query.tenantId = req.tenantId || req.user?.tenantId;
        }

        const product = await Product.findOneAndDelete(query);
        if (!product) {
            throw new NotFoundError('Product not found or unauthorized');
        }
        return res.json({ message: 'Product Deleted' });
    } catch (error) { return next(error); }
};
