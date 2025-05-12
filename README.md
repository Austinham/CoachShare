# CoachShare Frontend

CoachShare is a platform that connects coaches with clients, enabling seamless sharing of training regimens and workout plans.

## Technologies Used

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (v7 or higher)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Austinham/coachshare-frontend.git
cd coachshare-frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
VITE_API_URL=https://coachshare-api.vercel.app/api
VITE_CLIENT_URL=https://coachshare.vercel.app
```

4. Start the development server:
```bash
npm run dev
```

## Development

The development server will start at `http://localhost:5173` by default.

## Building for Production

To create a production build:

```bash
npm run build
```

The build output will be in the `dist` directory.

## Deployment

This project is deployed on Vercel. The production URL is: https://coachshare.vercel.app

## Project Structure

- `src/` - Source code
  - `components/` - React components
  - `lib/` - Utility functions and API clients
  - `pages/` - Page components
  - `types/` - TypeScript type definitions
  - `App.tsx` - Main application component
  - `main.tsx` - Application entry point

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
