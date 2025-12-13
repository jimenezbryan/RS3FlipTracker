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
