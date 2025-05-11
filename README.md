# CoachShare API

This is the backend/server for the CoachShare application.

## About

The CoachShare API provides the backend services for the CoachShare application, handling authentication, user management, and other core functionalities.

## Features

- User authentication and authorization
- Coach and client management
- Regimen management
- Profile management
- Email verification
- Password reset functionality

## API Endpoints

- `/api/auth` - Authentication endpoints
- `/api/users` - User management
- `/api/coaches` - Coach-specific endpoints
- `/api/clients` - Client-specific endpoints
- `/api/regimens` - Regimen management

## Environment Variables

Required environment variables:
- `NODE_ENV` - Environment (development/production)
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT token generation
- `JWT_EXPIRES_IN` - JWT token expiration time
- `JWT_COOKIE_EXPIRES_IN` - Cookie expiration time
- `CORS_ORIGIN` - Allowed CORS origin

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Create a `.env` file in the root directory with the required variables.

3. Start development server:
   ```bash
   npm run dev
   ```

## Production

1. Build the application:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

## License

MIT
