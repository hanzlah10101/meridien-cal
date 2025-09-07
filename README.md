# Meridien Calendar Server

A modern Express.js server with TypeScript for managing calendar events, optimized for Vercel deployment.

## 📁 Project Structure

```
meridien/
├── api/                    # Vercel API functions
│   └── [...all].ts        # Catch-all function for Express app
├── assets/                 # Static assets and data
│   ├── public/            # Public HTML files
│   │   └── Hotels.html    # Main calendar interface
│   └── data/              # Data files
│       └── events.json    # Events storage
├── src/                   # Source code
│   ├── api/               # Business logic
│   │   └── events-service.ts
│   ├── routes/            # Express routes
│   │   └── events.ts
│   ├── utils/             # Utilities
│   │   └── file-system.ts
│   ├── app.ts             # Main Express application
│   └── server.ts          # Legacy server file (moved)
├── dist/                  # Compiled TypeScript output
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── vercel.json           # Vercel deployment config
```

## 🚀 Features

- **Modern TypeScript**: Strict typing with path aliases (`@/*`)
- **Modular Architecture**: Clean separation of concerns
- **Vercel Ready**: Optimized for serverless deployment
- **File-based Storage**: JSON storage with Vercel-compatible paths
- **Express Router**: RESTful API endpoints
- **Development Friendly**: Hot reload with `tsx`

## 📝 API Endpoints

- `GET /api/events` - Get all events
- `POST /api/events` - Create a new event
- `PUT /api/events/:dateKey/:eventId` - Update an event
- `DELETE /api/events/:dateKey/:eventId` - Delete an event

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

## 🗂️ File Storage

- **Development**: Files stored in `assets/data/`
- **Vercel**: Ephemeral storage in `/tmp` (resets per invocation)
- **Note**: For persistent storage, consider Vercel KV, PostgreSQL, or external databases

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
