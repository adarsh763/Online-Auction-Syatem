const { body } = require('express-validator');

/**
 * Reusable validation chains for express-validator.
 */

const registerValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters'),
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
];

const loginValidation = [
    body('email')
        .trim()
        .notEmpty()
        .withMessage('Email is required')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
];

const auctionValidation = [
    body('title')
        .trim()
        .notEmpty()
        .withMessage('Title is required')
        .isLength({ max: 120 })
        .withMessage('Title cannot exceed 120 characters'),
    body('description')
        .trim()
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ max: 2000 })
        .withMessage('Description cannot exceed 2000 characters'),
    body('startingPrice')
        .notEmpty()
        .withMessage('Starting price is required')
        .isNumeric()
        .withMessage('Starting price must be a valid number'),
    body('endTime')
        .notEmpty()
        .withMessage('End time is required')
        .isISO8601()
        .withMessage('End time must be a valid ISO 8601 date')
        .custom((value) => {
            if (new Date(value) <= new Date()) {
                throw new Error('End time must be in the future');
            }
            return true;
        }),
];

const bidValidation = [
    body('auctionId')
        .notEmpty()
        .withMessage('Auction ID is required')
        .isMongoId()
        .withMessage('Invalid Auction ID format'),
    body('amount')
        .notEmpty()
        .withMessage('Bid amount is required')
        .isFloat({ min: 0.01 })
        .withMessage('Bid amount must be a positive number'),
];

module.exports = {
    registerValidation,
    loginValidation,
    auctionValidation,
    bidValidation,
};
