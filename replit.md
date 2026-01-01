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
- `portfolioHoldings` - Individual item holdings with quantity, avgBuyPrice, totalCost, realizedProfit, realizedLoss
- `portfolioHoldingTransactions` - Buy/sell transaction history per holding with P&L tracking
- `portfolioSnapshots` - Historical snapshots of total portfolio value
- `portfolioSnapshotItems` - Individual item data within each snapshot
- `recipes` - Recipe templates defining output items and required components
- `recipeComponents` - Component items needed for each recipe template
- `recipeRuns` - Active crafting runs tracking progress and costs
- `recipeRunComponents` - Logged component purchases per run with RS account tracking

### Recent Updates
- **Recipe/Set Crafting Tracker**: Track multi-component item crafting across RS accounts
  - Create recipe templates (define output item + required components with quantities)
  - Start crafting runs from templates
  - Log component purchases per RS account with buy prices
  - Track progress: see which components are acquired vs. needed
  - Complete runs: calculates profit (with GE tax), creates flip record for stats integration
  - View completed runs history with profit/loss
  - Database tables: `recipes`, `recipeComponents`, `recipeRuns`, `recipeRunComponents`
  - API routes: `/api/recipes`, `/api/recipe-runs`, `/api/recipe-run-components`
  - Frontend: `client/src/pages/Recipes.tsx` with tabs for templates, active runs, completed runs
  - Integrates with existing RS accounts system for multi-account tracking
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
- **Portfolio Transaction Tracking**: Complete buy/sell transaction history for each holding
  - Record buy and sell transactions with quantity, price, fees, and notes
  - Weighted average cost basis calculation for accurate P&L
  - Real-time P&L preview when selling (shows profit/loss before confirming)
  - Transaction history dialog with running realized P&L
  - Edit holdings directly (quantity, avg buy price, category, notes)
  - Backend validation prevents selling more than held
  - Allocation percentage shown on each holding card
- **AI Price Suggestions**: Get smart buy/sell price recommendations based on 90-day price history with confidence levels, volatility analysis, and one-click auto-fill buttons
- **AI-Powered Personalized Recommendations**: New "AI Tips" page that analyzes user's trading patterns (strategies, price ranges, ROI, hold times) and provides personalized item suggestions
  - Backend: `server/ai-recommendations.ts` - analyzeUserTradingProfile() and getPersonalizedRecommendations() using OpenAI
  - API routes: `/api/ai/trading-profile` and `/api/ai/recommendations`
  - Frontend: `AIRecommendations.tsx` component with trading profile display and recommendation cards
- **Trade History on Charts**: PriceHistoryChart now overlays user's actual trades on GE price data (green dots for buys, red dots for sells)
- **GP Stack Logo**: Custom SVG logo component (`GPStackLogo.tsx`) showing stacked gold coins with "GP" text
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
- **Admin Flip Visibility & Filtering**: Admin users can view and filter all flips from all users
  - Admin emails: fjnovarum@gmail.com, bjimenez@virtualsyncsolutions.com
  - Toggle between "My Flips" (personal stats) and "All Users" (admin view) on Home page
  - Filter by specific user when viewing all users
  - `/api/flips?scope=mine|all&userId=<id>` - scope and user filtering with admin validation
  - `getAllFlips()` storage method with user join for FlipWithUser type
  - FlipCard shows user badge when viewing as admin
  - Stats/Portfolio pages use user's own data only (not affected by admin view toggle)
- **Admin Edit Permissions**: Admins can edit any flip from any user
  - `storage.updateFlip()` accepts optional `skipOwnerCheck` parameter
  - PATCH `/api/flips/:id` checks admin status and bypasses owner check for admins
  - Transaction recording uses the flip owner's userId (not admin's) to preserve analytics
  - Regular users can still only edit their own flips
- **Price Chart Fixes for Missing ItemIds**: 
  - PriceHistoryChart automatically resolves itemId from itemName if missing via `/api/ge/resolve-id`
  - Backfill endpoint `/api/flips/backfill-item-ids` populates missing itemIds for existing flips
  - Batched processing (5 flips/batch with 500ms delays) to avoid GE API rate limits
  - Storage layer strips undefined values to prevent data clobbering during updates
  - All flips now show "View Chart" button regardless of itemId presence
- **GE Tax Calculation Update**: 
  - Removed 5M tax cap to match current RS3 rules
  - Tax is now: 2% of sell price per item (floored), multiplied by quantity, with no cap
  - Items sold for 49 gp or less per item are exempt (tax = 0)
  - Bonds remain tax exempt
  - Updated in `shared/taxCalculator.ts` and all frontend/backend components
- **Item Leaderboard**: Aggregated trading performance per item (leaderboard view)
  - New `/api/stats/item-summary` endpoint aggregates completed flips by item
  - Calculates total profit, total quantity traded, trade count, avg ROI, win rate, avg hold time
  - Uses shared `calculateFlipTax` for accurate profit calculations (handles bond/low-price exemptions)
  - `ItemLeaderboard.tsx` component with sortable table (click column headers to sort)
  - Displays item icons, profit with +/- indicators, and color-coded win rate badges
  - Added to Stats page between Performance by Strategy and Top Items charts

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