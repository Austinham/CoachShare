/**
 * Custom error class to handle operational errors in the application
 * Extends the built-in Error class
 */
class AppError extends Error {
  /**
   * Create a new AppError instance
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code for the error
   */
  constructor(message, statusCode) {
    super(message);
    
    this.statusCode = statusCode;
    // Determine status based on statusCode (4xx = fail, 5xx = error)
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // Operational errors are expected problems (e.g., user input error)
    // vs. programming errors (bugs)
    this.isOperational = true;
    
    // Capture the stack trace, excluding the constructor call
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError; 