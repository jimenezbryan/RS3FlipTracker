# RS3 Flip Tracker

## Overview
RS3 Flip Tracker is a RuneScape 3 Grand Exchange item flipping tracker designed to help players log buy/sell transactions, calculate profits and ROI, and analyze trading performance. The application aims to provide a comprehensive suite of tools for GE traders, including real-time price data integration, multi-account crafting tracking, advanced analytics, and portfolio management. The vision is to empower RS3 players with professional-grade trading insights and tools to maximize their in-game profits.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend
-   **Framework**: React 18 with TypeScript
-   **Routing**: Wouter
-   **State Management**: TanStack React Query
-   **UI Components**: shadcn/ui built on Radix UI, styled with Tailwind CSS (dark/light mode)
-   **Build Tool**: Vite

The frontend uses a component-based architecture, organizing code into pages, reusable UI components, feature-specific components, and custom hooks.

### Backend
-   **Runtime**: Node.js with Express.js
-   **Language**: TypeScript with ES modules
-   **API Design**: RESTful JSON API (`/api` prefix)
-   **Development**: Hot module replacement via Vite middleware

The server handles API endpoint definitions, data access, external GE API integration, and image OCR.

### Data Storage
-   **ORM**: Drizzle ORM (PostgreSQL dialect)
-   **Database**: Neon serverless PostgreSQL (with MemStorage fallback)
-   **Schema**: Defined in `shared/schema.ts` with Zod validation.
-   **Tables**: `users`, `flips`, `favorites`, `watchlist`, `priceAlerts`, `profitGoals`, `portfolioCategories`, `portfolioHoldings`, `portfolioHoldingTransactions`, `portfolioSnapshots`, `portfolioSnapshotItems`, `recipes`, `recipeComponents`, `recipeRuns`, `recipeRunComponents`.

### Key Features
-   **Multi-Authentication**: Replit OAuth, email/password, Discord OAuth.
-   **Flip Tracking**: Log buy/sell transactions, calculate profit, ROI. Supports "GE Trade" and "Street Trade" modes.
-   **Advanced Analytics**: Historical performance charts (equity curve, win rate, ROI), market movers dashboard, item leaderboards, performance by strategy analysis, AI price suggestions, and personalized recommendations.
-   **Portfolio Management**: Track holdings, categorize items, monitor value growth, manage transactions with P&L tracking, and create snapshots.
-   **Recipe/Set Crafting Tracker**: Create templates, log component purchases, track progress, and calculate profit for crafting runs across multiple RS accounts.
-   **User Experience**: Card-based flip display, item autocomplete with metadata (membership, GE limit), inline price charts, date input UX.
-   **Notifications**: Browser push notifications for price alerts, Discord daily trading summaries.
-   **Admin Features**: Admin users can view and filter all flips from all users, and edit any flip.
-   **GE Tax Calculation**: Updated to reflect current RS3 rules (2% of sell price per item, no cap, exemptions for low-value items/bonds).
-   **Design System**: Gaming-themed dark mode inspired by GE-Tracker, using Inter and JetBrains Mono fonts, and a custom color palette.

## External Dependencies
### Third-Party APIs
-   **WeirdGloop GE API**: Real-time Grand Exchange price data and historical trends.
-   **RuneScape Item Database**: Item icons and metadata.
-   **GE Dump API**: Complete item list for fuzzy matching.

### Database
-   **Neon Serverless**: PostgreSQL database.

### Key Frontend Libraries
-   **TanStack React Query**: Data fetching and caching.
-   **Radix UI**: Accessible component primitives.
-   **date-fns**: Date manipulation.
-   **react-day-picker**: Calendar component.
-   **lucide-react**: Icon library.