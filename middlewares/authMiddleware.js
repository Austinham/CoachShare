const jwt = require('jsonwebtoken');
const { promisify } = require('util'); // To promisify jwt.verify if needed, though it might be sync
const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const bcrypt = require('bcryptjs');

// Password validation middleware
exports.validatePassword = (req, res, next) => {
    const { password } = req.body;
    
    // Password requirements
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
        errors.push('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
        errors.push('Password must contain at least one special character');
    }
    
    if (errors.length > 0) {
        return next(new AppError(`Invalid password: ${errors.join(', ')}`, 400));
    }
    
    next();
};

// Middleware to protect routes (require login)
exports.protect = catchAsync(async (req, res, next) => {
    try {
        // 1) Getting token and check if it exists
        let token;
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')
        ) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies.jwt) {
            token = req.cookies.jwt;
        }

        if (!token) {
            return next(
                new AppError('You are not logged in! Please log in to get access.', 401)
            );
        }

        // 2) Verify token
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        // 3) Check if user still exists
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return next(
                new AppError(
                    'The user belonging to this token does no longer exist.',
                    401
                )
            );
        }

        // 4) Check if user changed password after the token was issued
        // This check depends on having `passwordChangedAt` field in your User model
        // and an `isPasswordChangedAfter` instance method
        if (currentUser.isPasswordChangedAfter && currentUser.isPasswordChangedAfter(decoded.iat)) {
            return next(
                new AppError('User recently changed password! Please log in again.', 401)
            );
        }

        // GRANT ACCESS TO PROTECTED ROUTE
        req.user = currentUser;
        res.locals.user = currentUser; // Optional: make user available in templates
        next();
    } catch (err) {
        next(new AppError('Authentication failed. Please log in again.', 401));
    }
});

// Middleware to restrict routes to specific roles
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        // roles ['admin', 'coach']. req.user.role is set by protect middleware
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError('You do not have permission to perform this action', 403)
            );
        }
        next();
    };
}; 