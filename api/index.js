const app = require('../server');
const cors = require('cors');

// Configure CORS for the API
const corsOptions = {
  origin: function(origin, callback) {
    // Log all incoming requests for debugging
    console.log('Incoming request from origin:', origin);

    // Allow any Vercel preview deployment
    const vercelPreviewPattern = /^https:\/\/coachshare-[a-z0-9]+-austinhams-projects\.vercel\.app$/;
    
    const allowedOrigins = [
      'https://coachshare.vercel.app',  // Production URL
      vercelPreviewPattern  // Any Vercel preview deployment
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('No origin provided, allowing request');
      return callback(null, true);
    }
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        const matches = allowed.test(origin);
        if (matches) {
          console.log('Origin matched regex pattern:', allowed);
        }
        return matches;
      }
      const matches = allowed === origin;
      if (matches) {
        console.log('Origin matched exact string:', allowed);
      }
      return matches;
    });

    if (!isAllowed) {
      console.log('CORS blocked request from origin:', origin);
      console.log('Allowed patterns:', allowedOrigins);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }

    console.log('CORS allowing request from origin:', origin);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Add preflight handling for all routes
app.options('*', cors(corsOptions));

// Export the Express app as a serverless function
module.exports = app; 