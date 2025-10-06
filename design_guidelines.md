# RS3 Item Flipping Tracker - Design Guidelines

## Design Approach

**Hybrid Reference-Based System**: Inspired by GE-Tracker and OSRS Exchange data-focused interfaces with a gaming-aesthetic dark theme. This combines the clarity of modern data presentation with the visual identity of RuneScape trading tools.

## Core Design Principles

1. **Data Clarity First**: Information hierarchy prioritizes critical flipping metrics (profit, ROI, margins)
2. **Gaming Aesthetic**: Dark theme with subtle RS-themed accents creates immersive trading experience
3. **Scan-ability**: Dense data tables optimized for quick analysis and decision-making
4. **Visual Feedback**: Color-coded profits and status indicators for instant comprehension

## Color Palette

### Dark Mode (Primary)
- **Background Base**: 220 15% 12% (Deep blue-gray)
- **Surface Primary**: 220 15% 16% (Elevated panels)
- **Surface Secondary**: 220 15% 20% (Cards, tables)
- **Border Subtle**: 220 15% 25% (Dividers)

### Accent & Status Colors
- **Primary Brand**: 210 90% 55% (Bright blue for CTAs, links)
- **Success/Profit**: 145 65% 50% (Green for positive margins)
- **Danger/Loss**: 0 70% 55% (Red for negative values)
- **Warning**: 35 85% 55% (Amber for alerts)
- **Neutral Data**: 220 10% 70% (Light gray text)

### Text Hierarchy
- **Primary Text**: 220 10% 95% (Headings, key data)
- **Secondary Text**: 220 10% 70% (Body, descriptions)
- **Tertiary Text**: 220 10% 50% (Metadata, timestamps)

## Typography

### Font Stack
- **Primary**: Inter or system-ui for optimal data readability
- **Monospace**: JetBrains Mono for price/numerical data

### Scale & Weights
- **Hero/Page Title**: text-3xl to text-4xl, font-bold (Primary text color)
- **Section Headers**: text-xl to text-2xl, font-semibold
- **Table Headers**: text-sm, font-medium, uppercase tracking-wide
- **Data Values**: text-base, font-medium (prices/numbers)
- **Body Text**: text-sm to text-base, font-normal
- **Micro Labels**: text-xs, font-medium (table metadata)

## Layout System

### Spacing Primitives
Use Tailwind units of **4, 6, 8, 12** for consistent rhythm:
- Component padding: p-4 to p-6
- Section spacing: py-8 to py-12
- Container gaps: gap-4 to gap-6
- Card spacing: p-6

### Grid Structure
- **Main Container**: max-w-7xl mx-auto px-4 to px-6
- **Dashboard Grid**: Two-column layout on desktop (2/3 table, 1/3 entry form)
- **Mobile**: Single column stack with prioritized data table

## Component Library

### Navigation Header
- Dark surface (220 15% 16%) with border-b
- Logo/brand left, navigation center, user actions right
- Sticky positioning with subtle shadow on scroll
- Height: h-16

### Data Entry Form (Flip Logger)
- Card surface with p-6 padding
- Stacked input fields with labels
- Item autocomplete with icon preview
- Date pickers styled to match theme
- Primary action button: Full-width, primary brand color
- Form validation: Inline error states in danger color

### Flip History Table
- **Striped rows**: Alternating 220 15% 16% and 220 15% 18%
- **Hover state**: 220 15% 22% with smooth transition
- **Sticky header**: Dark surface with border-b
- **Column structure**:
  - Item Icon (48x48px) + Name (left-aligned, font-medium)
  - Buy Price (monospace, right-aligned)
  - Sell Price (monospace, right-aligned)
  - Profit (monospace, color-coded: green positive, red negative)
  - ROI % (bold, color-coded)
  - Buy/Sell Dates (text-xs, tertiary text)
  - Actions (kebab menu, right-aligned)

### Item Display Cards
- Compact card with item icon, name, and quick stats
- 220 15% 20% background, rounded-lg, p-4
- Icon: 64x64px with border-subtle
- Horizontal layout: Icon left, data stacked right

### Filters & Search
- Search bar: Dark input with subtle border, icon left
- Filter chips: Pill-shaped, 220 15% 25% background
- Active filters: Primary brand color
- Clear all: Text button, secondary text color

### Buttons
- **Primary**: bg-primary (210 90% 55%), text-white, font-medium, rounded-md, px-6 py-2.5
- **Secondary**: bg-surface-secondary, border-subtle, text-primary
- **Danger**: bg-danger, text-white (for delete actions)
- **Ghost**: Transparent, hover:bg-surface-primary

### Empty States
- Centered icon (96x96px, tertiary color)
- Heading + description stack
- Primary CTA button below
- Subtle illustration or RS-themed graphic

### Status Badges
- Pill-shaped, px-3 py-1, text-xs font-medium
- Profit: bg-success/10 text-success border-success/20
- Loss: bg-danger/10 text-danger border-danger/20
- Pending: bg-warning/10 text-warning border-warning/20

## Data Visualization

### Profit Indicators
- Color-coded numbers: Green (profit), red (loss), gray (break-even)
- Arrow icons: ↑ for profit, ↓ for loss
- Percentage badges next to ROI values
- Monospace font for all numerical data

### Item Icons Integration
- 48x48px in tables, 64x64px in cards
- Rounded corners (rounded-md)
- Subtle border (border-subtle)
- Placeholder: Gray gradient with item initial

## Images

### Hero Section: NO
This is a utility dashboard - no hero section needed. Lead directly with the data table and entry form.

### Item Images
- **RS3 Wiki API Integration**: Fetch item icons dynamically
- **Fallback**: Placeholder with item name initial on gradient background
- **Sizes**: 48x48 (table), 64x64 (cards), 128x128 (detail view)
- **Style**: Clean PNG with transparent background, subtle shadow

## Animations

**Minimal & Purposeful**:
- Table row hover: 150ms ease background transition
- Button hover: 200ms ease scale(1.02)
- Modal/drawer entry: 250ms slide-up
- Loading states: Subtle skeleton screens (220 15% 20% shimmer)
- NO complex animations, scroll effects, or page transitions

## Responsive Behavior

### Desktop (lg:)
- Two-column layout: 2/3 table + 1/3 sidebar
- Full table with all columns visible
- Expanded filters and search

### Tablet (md:)
- Single column stack: Form above table
- Horizontal scroll for table if needed
- Condensed columns (hide less critical data)

### Mobile (base)
- Stacked card-style entries instead of table
- Collapsible filters drawer
- Bottom sheet for entry form
- Swipe actions for quick delete/edit

## Critical Quality Standards

- **Pixel-Perfect Alignment**: All table columns, form inputs aligned to 4px grid
- **Consistent Spacing**: Use only defined primitives (4, 6, 8, 12)
- **Color Consistency**: Status colors never deviate from defined palette
- **Data Density**: Maximize information per viewport without clutter
- **Accessibility**: WCAG AA contrast ratios, keyboard navigation for tables