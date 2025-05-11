const jwt = require('jsonwebtoken');

// Create and send JWT token
exports.createSendToken = (user, statusCode, res) => {
  // Create JWT token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });

  // Set cookie options
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  };

  // Send JWT in cookie
  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  // Send response
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
}; 