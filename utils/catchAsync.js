/**
 * Utility function to catch async errors in Express route handlers
 * Eliminates need for try/catch blocks in controllers
 * 
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Express middleware function that catches errors
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync; 