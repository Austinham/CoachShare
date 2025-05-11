const helmet = require('helmet');

// Security headers middleware
exports.securityHeaders = [
  // Basic security headers
  helmet(),
  
  // Content Security Policy
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  }),
  
  // Prevent clickjacking
  helmet.frameguard({ action: 'deny' }),
  
  // Prevent MIME type sniffing
  helmet.noSniff(),
  
  // Enable XSS filter
  helmet.xssFilter(),
  
  // Prevent IE from executing downloads
  helmet.ieNoOpen(),
  
  // Force HTTPS
  (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
      if (req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(`https://${req.headers.host}${req.url}`);
      }
    }
    next();
  },
  
  // Custom headers
  (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  }
]; 