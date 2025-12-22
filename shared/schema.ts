import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const flips = pgTable("flips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  itemId: integer("item_id"),
  quantity: integer("quantity").notNull().default(1),
  buyPrice: integer("buy_price").notNull(),
  sellPrice: integer("sell_price"),
  buyDate: timestamp("buy_date").notNull(),
  sellDate: timestamp("sell_date"),
  notes: text("notes"),
  category: varchar("category", { length: 50 }),
  strategyTag: varchar("strategy_tag", { length: 50 }).default("Other"),
  deletedAt: timestamp("deleted_at"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertFlipSchema = createInsertSchema(flips).omit({
  id: true,
  userId: true,
  deletedAt: true,
}).extend({
  itemId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().positive().default(1),
  buyPrice: z.coerce.number().int().positive(),
  sellPrice: z.coerce.number().int().positive().optional(),
  buyDate: z.coerce.date(),
  sellDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  category: z.string().max(50).optional(),
  strategyTag: z.enum(["Fast Flip", "Slow Flip", "Bulk", "High Margin", "Speculative", "Other"]).default("Other"),
});

export type InsertFlip = z.infer<typeof insertFlipSchema>;
export type Flip = typeof flips.$inferSelect;

// Watchlist table for tracking items without logging flips
export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  targetBuyPrice: integer("target_buy_price"),
  targetSellPrice: integer("target_sell_price"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  itemId: z.coerce.number().int().positive(),
  targetBuyPrice: z.coerce.number().int().positive().optional(),
  targetSellPrice: z.coerce.number().int().positive().optional(),
});

export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;
export type WatchlistItem = typeof watchlist.$inferSelect;

// Price alerts table
export const priceAlerts = pgTable("price_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  alertType: varchar("alert_type", { length: 10 }).notNull(), // 'above' or 'below'
  targetPrice: integer("target_price").notNull(),
  isActive: integer("is_active").notNull().default(1),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  userId: true,
  isActive: true,
  triggeredAt: true,
  createdAt: true,
}).extend({
  itemId: z.coerce.number().int().positive(),
  alertType: z.enum(["above", "below"]),
  targetPrice: z.coerce.number().int().positive(),
});

export type InsertPriceAlert = z.infer<typeof insertPriceAlertSchema>;
export type PriceAlert = typeof priceAlerts.$inferSelect;

// Favorite items for quick flip logging
export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  itemId: z.coerce.number().int().positive(),
});

export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

// Profit goals for tracking targets
export const profitGoals = pgTable("profit_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  goalType: varchar("goal_type", { length: 10 }).notNull(), // 'daily', 'weekly', 'monthly'
  targetAmount: integer("target_amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProfitGoalSchema = createInsertSchema(profitGoals).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  goalType: z.enum(["daily", "weekly", "monthly"]),
  targetAmount: z.coerce.number().int().positive(),
});

export type InsertProfitGoal = z.infer<typeof insertProfitGoalSchema>;
export type ProfitGoal = typeof profitGoals.$inferSelect;

// Portfolio categories for organizing holdings
export const portfolioCategories = pgTable("portfolio_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366f1"), // hex color
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPortfolioCategorySchema = createInsertSchema(portfolioCategories).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export type InsertPortfolioCategory = z.infer<typeof insertPortfolioCategorySchema>;
export type PortfolioCategory = typeof portfolioCategories.$inferSelect;

// Portfolio holdings - items you own as investments
export const portfolioHoldings = pgTable("portfolio_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  quantity: integer("quantity").notNull().default(1),
  avgBuyPrice: integer("avg_buy_price").notNull(), // weighted average buy price
  categoryId: varchar("category_id").references(() => portfolioCategories.id),
  source: varchar("source", { length: 20 }).default("manual"), // 'manual', 'screenshot', 'flip'
  notes: text("notes"),
  lastValuedPrice: integer("last_valued_price"),
  lastValuedAt: timestamp("last_valued_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({
  id: true,
  userId: true,
  lastValuedPrice: true,
  lastValuedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  itemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
  avgBuyPrice: z.coerce.number().int().positive(),
  categoryId: z.string().optional(),
  source: z.enum(["manual", "screenshot", "flip"]).optional(),
  notes: z.string().optional(),
});

export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;

// Portfolio snapshots for tracking value over time
export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalValue: integer("total_value").notNull(),
  totalCost: integer("total_cost").notNull(),
  totalProfit: integer("total_profit").notNull(),
  itemCount: integer("item_count").notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;

// Individual item values in each snapshot
export const portfolioSnapshotItems = pgTable("portfolio_snapshot_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").notNull().references(() => portfolioSnapshots.id),
  holdingId: varchar("holding_id").notNull(),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  avgBuyPrice: integer("avg_buy_price").notNull(),
  currentPrice: integer("current_price").notNull(),
  value: integer("value").notNull(),
  profit: integer("profit").notNull(),
  categoryId: varchar("category_id"),
});

export type PortfolioSnapshotItem = typeof portfolioSnapshotItems.$inferSelect;
