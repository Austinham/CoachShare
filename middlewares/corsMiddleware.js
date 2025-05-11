const cors = require('cors');

const corsOptions = {
  origin: function(origin, callback) {
    // Log all incoming requests for debugging
    console.log('CORS Middleware - Incoming request from origin:', origin);

    // Allow any Vercel preview deployment
    const vercelPreviewPattern = /^https:\/\/coachshare-[a-z0-9]+-austinhams-projects\.vercel\.app$/;
    
    const allowedOrigins = [
      'https://coachshare.vercel.app',  // Production URL
      vercelPreviewPattern,  // Any Vercel preview deployment
      'http://localhost:8080',  // Local development
      'http://localhost:8081',  // Local development
      'http://localhost:5173'   // Vite dev server
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('CORS Middleware - No origin provided, allowing request');
      return callback(null, true);
    }
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        const matches = allowed.test(origin);
        if (matches) {
          console.log('CORS Middleware - Origin matched regex pattern:', allowed);
        }
        return matches;
      }
      const matches = allowed === origin;
      if (matches) {
        console.log('CORS Middleware - Origin matched exact string:', allowed);
      }
      return matches;
    });

    if (!isAllowed) {
      console.log('CORS Middleware - Blocked request from origin:', origin);
      console.log('CORS Middleware - Allowed patterns:', allowedOrigins);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }

    console.log('CORS Middleware - Allowing request from origin:', origin);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

module.exports = cors(corsOptions); 