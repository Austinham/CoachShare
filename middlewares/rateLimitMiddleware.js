const rateLimit = require('express-rate-limit');
const AppError = require('../utils/appError');

// General API rate limiter
exports.apiLimiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX || 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  handler: (req, res, next) => {
    next(new AppError('Too many requests from this IP, please try again later.', 429));
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter limiter for auth routes
exports.authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 failed login attempts per hour
  message: 'Too many login attempts from this IP, please try again after an hour',
  handler: (req, res, next) => {
    next(new AppError('Too many login attempts from this IP, please try again after an hour', 429));
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// File upload limiter
exports.uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 file uploads per hour
  message: 'Too many file uploads from this IP, please try again later',
  handler: (req, res, next) => {
    next(new AppError('Too many file uploads from this IP, please try again later', 429));
  },
  standardHeaders: true,
  legacyHeaders: false,
}); 