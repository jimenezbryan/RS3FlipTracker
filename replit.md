# RS3 Flip Tracker

## Overview

RS3 Flip Tracker is a RuneScape 3 Grand Exchange item flipping tracker. It helps players log buy/sell transactions, calculate profits and ROI, and analyze trading performance. The application integrates with the WeirdGloop GE API for real-time price data and item search functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (dark/light mode support)
- **Build Tool**: Vite with React plugin

The frontend follows a component-based architecture with:
- Page components in `client/src/pages/`
- Reusable UI components in `client/src/components/ui/`
- Feature-specific components in `client/src/components/`
- Custom hooks in `client/src/hooks/`

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Design**: RESTful JSON API with `/api` prefix
- **Development**: Hot module replacement via Vite middleware integration

Key server modules:
- `server/routes.ts` - API endpoint definitions
- `server/storage.ts` - Data access layer with memory and database implementations
- `server/ge-api.ts` - External GE price API integration
- `server/ocr.ts` - Image OCR for extracting flip data from screenshots

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: Neon serverless PostgreSQL (configured via `DATABASE_URL`)
- **Schema**: Defined in `shared/schema.ts` with Zod validation via drizzle-zod
- **Migrations**: Output to `./migrations` directory

Database tables:
- `users` - User accounts with username/password
- `flips` - Item flip records with buy/sell prices, quantities, dates, and item metadata

### Design System
The application uses a gaming-themed dark mode design inspired by GE-Tracker:
- Dark blue-gray backgrounds
- Color-coded profit indicators (green for gains, red for losses)
- Inter font for UI, JetBrains Mono for numerical data
- Custom color palette defined in `design_guidelines.md`

## External Dependencies

### Third-Party APIs
- **WeirdGloop GE API** (`api.weirdgloop.org/exchange/history/rs`) - Real-time Grand Exchange price data and historical trends
- **RuneScape Item Database** (`secure.runescape.com/m=itemdb_rs`) - Item icons and metadata

### OCR Processing
- **Tesseract.js** - Client-side OCR for extracting flip data from uploaded screenshots

### Database
- **Neon Serverless** (`@neondatabase/serverless`) - PostgreSQL database with WebSocket support for serverless environments
- **connect-pg-simple** - PostgreSQL session storage (if sessions are added)

### Key Frontend Libraries
- **TanStack React Query** - Data fetching and caching
- **Radix UI** - Accessible component primitives
- **date-fns** - Date manipulation
- **react-day-picker** - Calendar component
- **lucide-react** - Icon library