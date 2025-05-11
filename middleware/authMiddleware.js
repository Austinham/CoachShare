const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/User');

// Protect routes
exports.protect = catchAsync(async (req, res, next) => {
  console.log('Auth middleware - Headers:', req.headers);
  
  // Check if JWT_SECRET is configured
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not configured');
    return res.status(500).json({
      status: 'error',
      message: 'Server configuration error'
    });
  }

  let token;
  
  // Get token from cookies
  if (req.cookies.jwt) {
    token = req.cookies.jwt;
    console.log('Token found in cookies');
  } 
  // Or from Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    console.log('Token found in Authorization header');
  }

  // Check if token exists
  if (!token) {
    console.log('No authentication token found');
    return res.status(401).json({
      status: 'fail',
      message: 'You are not logged in. Please log in to get access.'
    });
  }

  try {
    console.log('Verifying token...');
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified, user ID:', decoded.id);

    // Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      console.log(`User not found for token user ID: ${decoded.id}`);
      return res.status(401).json({
        status: 'fail',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    console.log(`User authenticated: ${currentUser.email} (${currentUser._id})`);
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token. Please log in again.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Your token has expired. Please log in again.'
      });
    }
    return res.status(500).json({
      status: 'error',
      message: 'Authentication error occurred'
    });
  }
});

// Restrict to certain roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      console.log(`User ${req.user.email} (${req.user.role}) attempted to access restricted route`);
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
}; 