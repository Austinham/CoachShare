const jwt = require('jsonwebtoken');

// Create and send JWT token
exports.createSendToken = (user, statusCode, res) => {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured');
      throw new Error('Server configuration error');
    }

    // Create JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    // Set cookie options
    const cookieOptions = {
      expires: new Date(
        Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 7) * 24 * 60 * 60 * 1000
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

    // Send response with token in both cookie and body
    res.status(statusCode).json({
      status: 'success',
      token, // Include token in response body for frontend storage
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Error creating token:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error creating authentication token'
    });
  }
}; 