# Meridien Calendar Server

A modern Express.js server with TypeScript for managing calendar events, optimized for Vercel deployment.

## 📁 Project Structure

```
meridien/
├── api/                    # Vercel API functions
│   └── [...all].ts        # Catch-all function for Express app
├── assets/                 # Static assets
│   └── Hotels.html        # Main calendar interface
├── src/                   # Source code
│   ├── api/               # Business logic
│   │   └── events-service.ts
│   ├── routes/            # Express routes
│   │   └── events.ts
│   ├── utils/             # Utilities
│   │   └── file-system.ts
│   ├── app.ts             # Main Express application
├── dist/                  # Compiled TypeScript output
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── vercel.json           # Vercel deployment config
```

## 🚀 Features

- **Modern TypeScript**: Strict typing with path aliases (`@/*`)
- **Modular Architecture**: Clean separation of concerns
- **Vercel Ready**: Optimized for serverless deployment
- **Firebase Persistence**: Events stored in Firebase Realtime Database
- **Express Router**: RESTful API endpoints
- **Development Friendly**: Hot reload with `tsx`

## 📝 API Endpoints

- `GET /api/events` - Get all events
- `POST /api/events` - Create a new event

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
## Firebase Realtime Database (Production persistence)

This project persists events in Firebase Realtime Database when deployed.

Environment variables required:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (escape newlines as `\n` when adding in Vercel UI)
- `FIREBASE_DATABASE_URL` (e.g., https://<project-id>-default-rtdb.<region>.firebasedatabase.app)

Copy `.env.example` to `.env` for local dev and fill values. On Vercel, set them in Project Settings → Environment Variables.


# Start production server
pnpm start

# Type checking
pnpm type-check
```

### Path Aliases

The project uses TypeScript path mapping for clean imports:

```typescript
import { EventsService } from "@/api/events-service"
import { FileSystemUtils } from "@/utils/file-system"
import { eventsRouter } from "@/routes/events"
```

## 🌐 Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
vercel

# Deploy to production
vercel --prod
```

The app is automatically configured for Vercel with:

- Serverless functions in `/api`
- Static asset serving from `/assets`
- Environment-aware file paths
- Build optimization

### Local Production

```bash
pnpm build
pnpm start
```

## 🗂️ Data Storage

Events are persisted in Firebase Realtime Database configured via environment variables.

## 🔧 Configuration

### TypeScript

- Base URL: `./src`
- Path mapping for `@/*` aliases
- Strict mode enabled
- ES2022 target

### Package Manager

Configured to use pnpm exclusively:

- Package manager field set to `pnpm@10.15.1`
- Engine requirements specified
- Lock file managed by pnpm

## 📋 Scripts

- `pnpm dev` - Development server with hot reload
- `pnpm build` - TypeScript compilation
- `pnpm start` - Production server
- `pnpm clean` - Remove build artifacts
- `pnpm type-check` - Type checking without emit
