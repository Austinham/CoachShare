const { logger } = require('../config/logger');

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  WARNING: 1000,  // 1 second
  CRITICAL: 3000  // 3 seconds
};

const performanceMiddleware = (req, res, next) => {
  const start = process.hrtime();

  // Add performance data to response locals
  res.locals.performance = {
    startTime: Date.now()
  };

  // Log when response is finished
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

    // Add performance data to response
    res.locals.performance.endTime = Date.now();
    res.locals.performance.duration = duration;

    // Log performance metrics
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration.toFixed(2)}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')
    };

    // Log with appropriate level based on duration
    if (duration >= THRESHOLDS.CRITICAL) {
      logger.error('Critical performance issue', logData);
    } else if (duration >= THRESHOLDS.WARNING) {
      logger.warn('Performance warning', logData);
    } else {
      logger.info('Request completed', logData);
    }

    // Add performance headers
    res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
    res.setHeader('X-Request-Id', req.id || 'unknown');
  });

  next();
};

module.exports = performanceMiddleware; 