import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// HASH PASSWORD
export const hashPassword = async (password) => {
    return bcrypt.hash(password, SALT_ROUNDS);
};

// COMPARE PLAIN PASSWORD WITH HASHED PASSWORD
export const comparePassword = async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
};