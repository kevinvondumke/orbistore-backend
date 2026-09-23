import Product from '../models/product.model.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

// GET ALL PRODUCTS (PUBLIC) + PAGINATION
/** @type {import('express').RequestHandler} */
export const getProducts = async (req, res, next) => {
    try {
        const { page, limit } = res.locals.query;
        return res.json(
            await Product
                .find()
                .sort({ createdAt: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
        );

    } catch (error) {
        next(error);
    }
};

// GET SINGLE PRODUCT (PUBLIC)
/** @type {import('express').RequestHandler} */
export const getProduct = async (req, res, next) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) throw new NotFoundError('Product not found');
        return res.json(product);
    } catch (error) {
        next(error);
    }
};

// CREATE PRODUCT (ADMIN ONLY) + VALIDATE INPUT
/** @type {import('express').RequestHandler} */
export const createProduct = async (req, res, next) => {
    try {
        return res.status(201).json(
            await Product.create(req.body)
        );
    } catch (error) {
        next(error);
    }
};

// UPDATE PRODUCT (ADMIN ONLY) + VALIDATE ID
/** @type {import('express').RequestHandler} */
export const updateProduct = async (req, res, next) => {
    try {
        const product = await Product
            .findByIdAndUpdate(
                req.params.id,
                { $set: req.body },
                { returnDocument: 'after', runValidators: true }
            );
        if (!product) throw new NotFoundError('Product not found');
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

        const product = await Product.findByIdAndDelete(id);
        if (!product) {
            throw new NotFoundError('Product not found');
        }
        return res.json({ message: 'Product Deleted' });
    } catch (error) { return next(error); }
};
