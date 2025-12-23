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
- **Fallback**: MemStorage in-memory storage when database is unavailable
- **Schema**: Defined in `shared/schema.ts` with Zod validation via drizzle-zod (uses z.coerce for type conversion)
- **Migrations**: Output to `./migrations` directory

Database tables:
- `users` - User accounts with username/password
- `flips` - Item flip records with buy/sell prices, quantities, dates, and item metadata
- `favorites` - Saved favorite items for quick flip logging
- `watchlist` - Items being tracked without active flips
- `priceAlerts` - Price alert configurations for notification triggers
- `profitGoals` - Daily/weekly/monthly profit targets
- `portfolioCategories` - Categories for organizing portfolio holdings
- `portfolioHoldings` - Individual item holdings with quantity, buy price, and current value
- `portfolioSnapshots` - Historical snapshots of total portfolio value
- `portfolioSnapshotItems` - Individual item data within each snapshot

### Recent Updates
- **Card-Based Flip Display**: Replaced table layout with responsive card grid
  - FlipCard component with Coinbase-style UX: expandable cards, smooth animations
  - Essential info (Item, Prices, Profit badge) visible by default
  - Secondary details (ROI, Tax, Dates, Notes, GE Limit) in expandable section
  - FlipCardGrid with CSS Grid layout: 1 column mobile, 2-3 columns desktop
  - Filter and sort controls with dropdown menus
- **Auto-Fetch Item Metadata**: When selecting items from autocomplete, automatically fetches:
  - Membership status (Members/F2P) - stored in isMembers column
  - GE Buy Limit - stored in geLimit column
  - Volume data displayed in form
- **Strategy Tags for Flips**: Each flip is now tagged with a trading strategy (Fast Flip, Slow Flip, Bulk, High Margin, Speculative, Other) for better analysis
  - Required dropdown on Log Flip form
  - New "Performance by Strategy" table in Stats page showing Total Profit, Avg ROI, Win Rate, and Avg Hold Time
  - Enables detailed trading strategy performance analysis
- **Portfolio Management**: Full portfolio tracking with category organization, value tracking, and investment growth charts
  - Add holdings manually with item search, quantity, and buy price
  - Organize holdings into custom categories with color coding
  - Create value snapshots to track portfolio growth over time
  - Interactive area charts showing value vs cost with profit indicators
  - Filter holdings by category with expandable/collapsible sections
- **AI Price Suggestions**: Get smart buy/sell price recommendations based on 90-day price history with confidence levels, volatility analysis, and one-click auto-fill buttons
- **Inline Price Charts**: View price history charts directly in the flip form when logging trades
- **Price History Charts**: View 90-day price trends with area charts, averages, and buy/sell recommendations
- **Browser Push Notifications**: Get notified when price alerts trigger (60-second check interval)
- **Profit Goals**: Set and track daily, weekly, and monthly profit targets with progress bars
- **Soft Delete with Undo**: Delete flips with undo option in toast notifications
- **CSV Export**: Download flip history as CSV file
- **Portfolio View**: See all open positions with total investment
- **Categories/Tags**: Organize flips by category with filter support
- **Quick Sell**: Sell open positions at current GE price with one click
- **Item Autocomplete**: Type to search all GE items with fuzzy matching, shows icons and live prices
- **Date Input UX**: Calendar/Popover with quick presets (Today, Yesterday, Week ago)
- **Storage Fallback**: MemStorage fallback when database is unavailable

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

### Item Search
- **GE Dump API** (`chisel.weirdgloop.org/gazproj/gazbot/rs_dump.json`) - Complete item list with prices, cached for 30 minutes
- **Fuzzy Matching** - Searches item names with priority: exact match > starts with > word starts with > contains

### Database
- **Neon Serverless** (`@neondatabase/serverless`) - PostgreSQL database with WebSocket support for serverless environments
- **connect-pg-simple** - PostgreSQL session storage (if sessions are added)

### Key Frontend Libraries
- **TanStack React Query** - Data fetching and caching
- **Radix UI** - Accessible component primitives
- **date-fns** - Date manipulation
- **react-day-picker** - Calendar component
- **lucide-react** - Icon library