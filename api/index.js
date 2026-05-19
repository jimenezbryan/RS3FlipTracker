var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/app.ts
import express from "express";

// server/routes.ts
import { createServer } from "http";
import multer from "multer";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  favorites: () => favorites,
  flipTransactions: () => flipTransactions,
  flips: () => flips,
  insertFavoriteSchema: () => insertFavoriteSchema,
  insertFlipSchema: () => insertFlipSchema,
  insertHoldingTransactionSchema: () => insertHoldingTransactionSchema,
  insertPortfolioCategorySchema: () => insertPortfolioCategorySchema,
  insertPortfolioHoldingSchema: () => insertPortfolioHoldingSchema,
  insertPriceAlertSchema: () => insertPriceAlertSchema,
  insertProfitGoalSchema: () => insertProfitGoalSchema,
  insertRecipeComponentSchema: () => insertRecipeComponentSchema,
  insertRecipeRunComponentSchema: () => insertRecipeRunComponentSchema,
  insertRecipeRunSchema: () => insertRecipeRunSchema,
  insertRecipeSchema: () => insertRecipeSchema,
  insertRsAccountSchema: () => insertRsAccountSchema,
  insertWatchlistSchema: () => insertWatchlistSchema,
  itemVolumeDaily: () => itemVolumeDaily,
  membershipStatusEnum: () => membershipStatusEnum,
  portfolioCategories: () => portfolioCategories,
  portfolioHoldingTransactions: () => portfolioHoldingTransactions,
  portfolioHoldings: () => portfolioHoldings,
  portfolioSnapshotItems: () => portfolioSnapshotItems,
  portfolioSnapshots: () => portfolioSnapshots,
  priceAlerts: () => priceAlerts,
  profitGoals: () => profitGoals,
  recipeComponents: () => recipeComponents,
  recipeRunComponents: () => recipeRunComponents,
  recipeRunStatusEnum: () => recipeRunStatusEnum,
  recipeRuns: () => recipeRuns,
  recipes: () => recipes,
  rsAccountTypeEnum: () => rsAccountTypeEnum,
  rsAccounts: () => rsAccounts,
  sessions: () => sessions,
  updatePortfolioHoldingSchema: () => updatePortfolioHoldingSchema,
  userSessions: () => userSessions,
  users: () => users,
  watchlist: () => watchlist
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, bigint, timestamp, index, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var membershipStatusEnum = pgEnum("membership_status", ["F2P", "Members", "Unknown"]);
var rsAccountTypeEnum = pgEnum("rs_account_type", ["Main", "Ironman", "HCIM", "Ultimate", "GIM", "Alt", "Other"]);
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  password: varchar("password"),
  authProvider: varchar("auth_provider", { length: 20 }).default("replit"),
  discordId: varchar("discord_id").unique(),
  isAdmin: boolean("is_admin").default(false),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var rsAccounts = pgTable("rs_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  displayName: varchar("display_name", { length: 12 }).notNull(),
  // RSN max 12 chars
  accountType: rsAccountTypeEnum("account_type").default("Main"),
  isDefault: boolean("is_default").default(false),
  preferredWorld: integer("preferred_world"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertRsAccountSchema = createInsertSchema(rsAccounts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  displayName: z.string().min(1).max(12),
  accountType: z.enum(["Main", "Ironman", "HCIM", "Ultimate", "GIM", "Alt", "Other"]).default("Main"),
  isDefault: z.boolean().optional(),
  preferredWorld: z.coerce.number().int().positive().optional(),
  notes: z.string().optional()
});
var flips = pgTable("flips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  rsAccountId: varchar("rs_account_id").references(() => rsAccounts.id),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  itemId: integer("item_id"),
  quantity: integer("quantity").notNull().default(1),
  buyPrice: bigint("buy_price", { mode: "number" }).notNull(),
  sellPrice: bigint("sell_price", { mode: "number" }),
  buyDate: timestamp("buy_date").notNull(),
  sellDate: timestamp("sell_date"),
  notes: text("notes"),
  category: varchar("category", { length: 50 }),
  strategyTag: varchar("strategy_tag", { length: 50 }).default("Other"),
  membershipStatus: membershipStatusEnum("membership_status").default("Unknown"),
  isMembers: boolean("is_members"),
  geLimit: integer("ge_limit"),
  tradeType: varchar("trade_type", { length: 20 }).default("ge").notNull(),
  deletedAt: timestamp("deleted_at")
});
var insertFlipSchema = createInsertSchema(flips).omit({
  id: true,
  userId: true,
  deletedAt: true
}).extend({
  rsAccountId: z.string().optional(),
  itemId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().positive().default(1),
  buyPrice: z.coerce.number().int().positive(),
  sellPrice: z.coerce.number().int().positive().optional(),
  buyDate: z.coerce.date(),
  sellDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  category: z.string().max(50).optional(),
  strategyTag: z.enum(["Fast Flip", "Slow Flip", "Bulk", "High Margin", "Speculative", "Other"]).default("Other"),
  membershipStatus: z.enum(["F2P", "Members", "Unknown"]).default("Unknown"),
  isMembers: z.boolean().optional(),
  geLimit: z.coerce.number().int().positive().optional(),
  tradeType: z.enum(["ge", "street"]).default("ge")
});
var watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  targetBuyPrice: bigint("target_buy_price", { mode: "number" }),
  targetSellPrice: bigint("target_sell_price", { mode: "number" }),
  membershipStatus: membershipStatusEnum("membership_status").default("Unknown"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  userId: true,
  createdAt: true
}).extend({
  itemId: z.coerce.number().int().positive(),
  targetBuyPrice: z.coerce.number().int().positive().optional(),
  targetSellPrice: z.coerce.number().int().positive().optional(),
  membershipStatus: z.enum(["F2P", "Members", "Unknown"]).default("Unknown")
});
var priceAlerts = pgTable("price_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  alertType: varchar("alert_type", { length: 10 }).notNull(),
  // 'above' or 'below'
  targetPrice: bigint("target_price", { mode: "number" }).notNull(),
  membershipStatus: membershipStatusEnum("membership_status").default("Unknown"),
  isActive: integer("is_active").notNull().default(1),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertPriceAlertSchema = createInsertSchema(priceAlerts).omit({
  id: true,
  userId: true,
  isActive: true,
  triggeredAt: true,
  createdAt: true
}).extend({
  itemId: z.coerce.number().int().positive(),
  alertType: z.enum(["above", "below"]),
  targetPrice: z.coerce.number().int().positive(),
  membershipStatus: z.enum(["F2P", "Members", "Unknown"]).default("Unknown")
});
var favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertFavoriteSchema = createInsertSchema(favorites).omit({
  id: true,
  userId: true,
  createdAt: true
}).extend({
  itemId: z.coerce.number().int().positive()
});
var profitGoals = pgTable("profit_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  goalType: varchar("goal_type", { length: 10 }).notNull(),
  // 'daily', 'weekly', 'monthly'
  targetAmount: bigint("target_amount", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertProfitGoalSchema = createInsertSchema(profitGoals).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true
}).extend({
  goalType: z.enum(["daily", "weekly", "monthly"]),
  targetAmount: z.coerce.number().int().positive()
});
var portfolioCategories = pgTable("portfolio_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).default("#6366f1"),
  // hex color
  createdAt: timestamp("created_at").defaultNow()
});
var insertPortfolioCategorySchema = createInsertSchema(portfolioCategories).omit({
  id: true,
  userId: true,
  createdAt: true
}).extend({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});
var portfolioHoldings = pgTable("portfolio_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  quantity: integer("quantity").notNull().default(1),
  avgBuyPrice: bigint("avg_buy_price", { mode: "number" }).notNull(),
  // weighted average buy price
  totalCost: bigint("total_cost", { mode: "number" }).notNull().default(0),
  // total invested
  realizedProfit: bigint("realized_profit", { mode: "number" }).notNull().default(0),
  // profit from completed sales
  realizedLoss: bigint("realized_loss", { mode: "number" }).notNull().default(0),
  // loss from completed sales
  categoryId: varchar("category_id").references(() => portfolioCategories.id),
  source: varchar("source", { length: 20 }).default("manual"),
  // 'manual', 'screenshot', 'flip'
  notes: text("notes"),
  lastValuedPrice: bigint("last_valued_price", { mode: "number" }),
  lastValuedAt: timestamp("last_valued_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertPortfolioHoldingSchema = createInsertSchema(portfolioHoldings).omit({
  id: true,
  userId: true,
  totalCost: true,
  realizedProfit: true,
  realizedLoss: true,
  lastValuedPrice: true,
  lastValuedAt: true,
  createdAt: true,
  updatedAt: true
}).extend({
  itemId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().default(1),
  avgBuyPrice: z.coerce.number().int().positive(),
  categoryId: z.string().optional(),
  source: z.enum(["manual", "screenshot", "flip"]).optional(),
  notes: z.string().optional()
});
var updatePortfolioHoldingSchema = z.object({
  quantity: z.coerce.number().int().positive().optional(),
  avgBuyPrice: z.coerce.number().int().positive().optional(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});
var portfolioHoldingTransactions = pgTable("portfolio_holding_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  holdingId: varchar("holding_id").notNull().references(() => portfolioHoldings.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionType: varchar("transaction_type", { length: 10 }).notNull(),
  // 'buy' or 'sell'
  quantity: integer("quantity").notNull(),
  pricePerUnit: bigint("price_per_unit", { mode: "number" }).notNull(),
  totalValue: bigint("total_value", { mode: "number" }).notNull(),
  fees: bigint("fees", { mode: "number" }).default(0),
  // GE tax for sells
  profitLoss: bigint("profit_loss", { mode: "number" }),
  // calculated on sell: (sellPrice - avgBuyPrice) * quantity - fees
  notes: text("notes"),
  transactionDate: timestamp("transaction_date").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var insertHoldingTransactionSchema = createInsertSchema(portfolioHoldingTransactions).omit({
  id: true,
  userId: true,
  totalValue: true,
  profitLoss: true,
  createdAt: true
}).extend({
  holdingId: z.string(),
  transactionType: z.enum(["buy", "sell"]),
  quantity: z.coerce.number().int().positive(),
  pricePerUnit: z.coerce.number().int().positive(),
  fees: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
  transactionDate: z.coerce.date()
});
var portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalValue: bigint("total_value", { mode: "number" }).notNull(),
  totalCost: bigint("total_cost", { mode: "number" }).notNull(),
  totalProfit: bigint("total_profit", { mode: "number" }).notNull(),
  itemCount: integer("item_count").notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var portfolioSnapshotItems = pgTable("portfolio_snapshot_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotId: varchar("snapshot_id").notNull().references(() => portfolioSnapshots.id),
  holdingId: varchar("holding_id").notNull(),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  quantity: integer("quantity").notNull(),
  avgBuyPrice: bigint("avg_buy_price", { mode: "number" }).notNull(),
  currentPrice: bigint("current_price", { mode: "number" }).notNull(),
  value: bigint("value", { mode: "number" }).notNull(),
  profit: bigint("profit", { mode: "number" }).notNull(),
  categoryId: varchar("category_id")
});
var flipTransactions = pgTable("flip_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flipId: varchar("flip_id").references(() => flips.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  transactionType: varchar("transaction_type", { length: 10 }).notNull(),
  // 'buy' or 'sell'
  price: bigint("price", { mode: "number" }).notNull(),
  quantity: integer("quantity").notNull(),
  totalValue: bigint("total_value", { mode: "number" }).notNull(),
  taxPaid: bigint("tax_paid", { mode: "number" }).default(0),
  // Only for sell transactions
  strategyTag: varchar("strategy_tag", { length: 50 }),
  transactionDate: timestamp("transaction_date").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var itemVolumeDaily = pgTable("item_volume_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  date: timestamp("date").notNull(),
  transactionCount: integer("transaction_count").notNull().default(0),
  totalQuantity: integer("total_quantity").notNull().default(0),
  totalValue: bigint("total_value", { mode: "number" }).notNull().default(0),
  avgPrice: bigint("avg_price", { mode: "number" }).default(0),
  minPrice: bigint("min_price", { mode: "number" }),
  maxPrice: bigint("max_price", { mode: "number" }),
  buyCount: integer("buy_count").default(0),
  sellCount: integer("sell_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  lastHeartbeat: timestamp("last_heartbeat").notNull(),
  status: varchar("status", { length: 10 }).notNull().default("online"),
  // 'online' or 'offline'
  createdAt: timestamp("created_at").defaultNow()
});
var recipeRunStatusEnum = pgEnum("recipe_run_status", ["gathering", "ready", "crafted", "sold", "cancelled"]);
var recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),
  outputItemId: integer("output_item_id"),
  outputItemName: text("output_item_name").notNull(),
  outputItemIcon: text("output_item_icon"),
  outputQuantity: integer("output_quantity").notNull().default(1),
  notes: text("notes"),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  userId: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true
}).extend({
  name: z.string().min(1).max(100),
  outputItemId: z.coerce.number().int().positive().optional(),
  outputItemName: z.string().min(1),
  outputItemIcon: z.string().optional(),
  outputQuantity: z.coerce.number().int().positive().default(1),
  notes: z.string().optional()
});
var recipeComponents = pgTable("recipe_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  itemId: integer("item_id"),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  quantityRequired: integer("quantity_required").notNull().default(1),
  notes: text("notes")
});
var insertRecipeComponentSchema = createInsertSchema(recipeComponents).omit({
  id: true
}).extend({
  recipeId: z.string(),
  itemId: z.coerce.number().int().positive().optional(),
  itemName: z.string().min(1),
  itemIcon: z.string().optional(),
  quantityRequired: z.coerce.number().int().positive().default(1),
  notes: z.string().optional()
});
var recipeRuns = pgTable("recipe_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  status: recipeRunStatusEnum("status").notNull().default("gathering"),
  targetSellPrice: bigint("target_sell_price", { mode: "number" }),
  actualSellPrice: bigint("actual_sell_price", { mode: "number" }),
  totalComponentCost: bigint("total_component_cost", { mode: "number" }).default(0),
  profit: bigint("profit", { mode: "number" }),
  linkedFlipId: varchar("linked_flip_id").references(() => flips.id),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  notes: text("notes")
});
var insertRecipeRunSchema = createInsertSchema(recipeRuns).omit({
  id: true,
  userId: true,
  status: true,
  totalComponentCost: true,
  profit: true,
  linkedFlipId: true,
  startedAt: true,
  completedAt: true
}).extend({
  recipeId: z.string(),
  targetSellPrice: z.coerce.number().int().positive().optional(),
  actualSellPrice: z.coerce.number().int().positive().optional(),
  notes: z.string().optional()
});
var recipeRunComponents = pgTable("recipe_run_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => recipeRuns.id),
  componentId: varchar("component_id").notNull().references(() => recipeComponents.id),
  rsAccountId: varchar("rs_account_id").references(() => rsAccounts.id),
  quantityAcquired: integer("quantity_acquired").notNull().default(0),
  buyPrice: bigint("buy_price", { mode: "number" }).notNull(),
  totalCost: bigint("total_cost", { mode: "number" }).notNull(),
  purchaseDate: timestamp("purchase_date").defaultNow(),
  notes: text("notes")
});
var insertRecipeRunComponentSchema = createInsertSchema(recipeRunComponents).omit({
  id: true,
  purchaseDate: true
}).extend({
  runId: z.string(),
  componentId: z.string(),
  rsAccountId: z.string().optional(),
  quantityAcquired: z.coerce.number().int().positive(),
  buyPrice: z.coerce.number().int().positive(),
  totalCost: z.coerce.number().int().positive(),
  notes: z.string().optional()
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, desc, and, isNull, sql as sql2, gte, lte, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
var MemStorage = class {
  users = /* @__PURE__ */ new Map();
  flips = /* @__PURE__ */ new Map();
  watchlistItems = /* @__PURE__ */ new Map();
  alerts = /* @__PURE__ */ new Map();
  favoriteItems = /* @__PURE__ */ new Map();
  goals = /* @__PURE__ */ new Map();
  portfolioCats = /* @__PURE__ */ new Map();
  portfolioHolds = /* @__PURE__ */ new Map();
  portfolioSnaps = /* @__PURE__ */ new Map();
  portfolioSnapItems = /* @__PURE__ */ new Map();
  async getUser(id) {
    return this.users.get(id);
  }
  async upsertUser(userData) {
    const existing = userData.id ? this.users.get(userData.id) : void 0;
    if (existing) {
      const updated = {
        ...existing,
        ...userData,
        updatedAt: /* @__PURE__ */ new Date()
      };
      this.users.set(existing.id, updated);
      return updated;
    }
    const id = userData.id || randomUUID();
    const user = {
      id,
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      password: userData.password ?? null,
      authProvider: userData.authProvider ?? "replit",
      discordId: userData.discordId ?? null,
      isAdmin: userData.isAdmin ?? false,
      lastSeenAt: null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(id, user);
    return user;
  }
  async updateUserProfile(userId, data) {
    const user = this.users.get(userId);
    if (!user) return void 0;
    const updated = {
      ...user,
      ...data,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(userId, updated);
    return updated;
  }
  async createFlip(userId, flip) {
    const id = randomUUID();
    const newFlip = {
      id,
      userId,
      rsAccountId: flip.rsAccountId ?? null,
      itemName: flip.itemName,
      itemIcon: flip.itemIcon ?? null,
      itemId: flip.itemId ?? null,
      quantity: flip.quantity ?? 1,
      buyPrice: flip.buyPrice,
      sellPrice: flip.sellPrice ?? null,
      buyDate: flip.buyDate,
      sellDate: flip.sellDate ?? null,
      notes: flip.notes ?? null,
      category: flip.category ?? null,
      strategyTag: flip.strategyTag ?? "Other",
      membershipStatus: flip.membershipStatus ?? "Unknown",
      isMembers: flip.isMembers ?? null,
      geLimit: flip.geLimit ?? null,
      tradeType: flip.tradeType ?? "ge",
      deletedAt: null
    };
    this.flips.set(id, newFlip);
    return newFlip;
  }
  async getFlips(userId) {
    return Array.from(this.flips.values()).filter((f) => f.userId === userId && f.deletedAt === null).sort((a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime());
  }
  async getAllFlips() {
    const allFlips = Array.from(this.flips.values()).filter((f) => f.deletedAt === null).sort((a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime());
    return allFlips.map((flip) => {
      const user = this.users.get(flip.userId);
      return {
        ...flip,
        user: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        } : void 0
      };
    });
  }
  async getFlip(id) {
    return this.flips.get(id);
  }
  async updateFlip(id, userId, flipUpdate, skipOwnerCheck) {
    const existing = this.flips.get(id);
    if (!existing) return void 0;
    if (!skipOwnerCheck && existing.userId !== userId) return void 0;
    const updated = {
      ...existing,
      ...flipUpdate,
      sellPrice: flipUpdate.sellPrice ?? existing.sellPrice,
      sellDate: flipUpdate.sellDate ?? existing.sellDate
    };
    this.flips.set(id, updated);
    return updated;
  }
  async deleteFlip(id, userId) {
    const existing = this.flips.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.flips.delete(id);
  }
  async softDeleteFlip(id, userId) {
    const existing = this.flips.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    const updated = { ...existing, deletedAt: /* @__PURE__ */ new Date() };
    this.flips.set(id, updated);
    return updated;
  }
  async restoreFlip(id, userId) {
    const existing = this.flips.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    const updated = { ...existing, deletedAt: null };
    this.flips.set(id, updated);
    return updated;
  }
  async getUserFlipsByItemId(userId, itemId) {
    return Array.from(this.flips.values()).filter((f) => f.userId === userId && f.itemId === itemId && f.deletedAt === null).sort((a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime());
  }
  async createWatchlistItem(userId, item) {
    const id = randomUUID();
    const newItem = {
      id,
      userId,
      itemId: item.itemId,
      itemName: item.itemName,
      itemIcon: item.itemIcon ?? null,
      targetBuyPrice: item.targetBuyPrice ?? null,
      targetSellPrice: item.targetSellPrice ?? null,
      membershipStatus: item.membershipStatus ?? "Unknown",
      notes: item.notes ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.watchlistItems.set(id, newItem);
    return newItem;
  }
  async getWatchlist(userId) {
    return Array.from(this.watchlistItems.values()).filter((w) => w.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async getWatchlistItem(id) {
    return this.watchlistItems.get(id);
  }
  async updateWatchlistItem(id, userId, item) {
    const existing = this.watchlistItems.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    const updated = { ...existing, ...item };
    this.watchlistItems.set(id, updated);
    return updated;
  }
  async deleteWatchlistItem(id, userId) {
    const existing = this.watchlistItems.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.watchlistItems.delete(id);
  }
  async createPriceAlert(userId, alert) {
    const id = randomUUID();
    const newAlert = {
      id,
      userId,
      itemId: alert.itemId,
      itemName: alert.itemName,
      itemIcon: alert.itemIcon ?? null,
      alertType: alert.alertType,
      targetPrice: alert.targetPrice,
      membershipStatus: alert.membershipStatus ?? "Unknown",
      isActive: 1,
      triggeredAt: null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.alerts.set(id, newAlert);
    return newAlert;
  }
  async getPriceAlerts(userId) {
    return Array.from(this.alerts.values()).filter((a) => a.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async getPriceAlert(id) {
    return this.alerts.get(id);
  }
  async updatePriceAlert(id, userId, alert) {
    const existing = this.alerts.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    const updated = { ...existing, ...alert };
    this.alerts.set(id, updated);
    return updated;
  }
  async deletePriceAlert(id, userId) {
    const existing = this.alerts.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.alerts.delete(id);
  }
  async createFavorite(userId, favorite) {
    const id = randomUUID();
    const newFavorite = {
      id,
      userId,
      itemId: favorite.itemId,
      itemName: favorite.itemName,
      itemIcon: favorite.itemIcon ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.favoriteItems.set(id, newFavorite);
    return newFavorite;
  }
  async getFavorites(userId) {
    return Array.from(this.favoriteItems.values()).filter((f) => f.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async deleteFavorite(id, userId) {
    const existing = this.favoriteItems.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.favoriteItems.delete(id);
  }
  async createProfitGoal(userId, goal) {
    const id = randomUUID();
    const newGoal = {
      id,
      userId,
      goalType: goal.goalType,
      targetAmount: goal.targetAmount,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.goals.set(id, newGoal);
    return newGoal;
  }
  async getProfitGoals(userId) {
    return Array.from(this.goals.values()).filter((g) => g.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async updateProfitGoal(id, userId, goal) {
    const existing = this.goals.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    const updated = { ...existing, ...goal, updatedAt: /* @__PURE__ */ new Date() };
    this.goals.set(id, updated);
    return updated;
  }
  async deleteProfitGoal(id, userId) {
    const existing = this.goals.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.goals.delete(id);
  }
  // Portfolio Categories
  async createPortfolioCategory(userId, category) {
    const id = randomUUID();
    const newCat = {
      id,
      userId,
      name: category.name,
      color: category.color ?? "#6366f1",
      createdAt: /* @__PURE__ */ new Date()
    };
    this.portfolioCats.set(id, newCat);
    return newCat;
  }
  async getPortfolioCategories(userId) {
    return Array.from(this.portfolioCats.values()).filter((c) => c.userId === userId).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }
  async updatePortfolioCategory(id, userId, category) {
    const existing = this.portfolioCats.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    const updated = { ...existing, ...category };
    this.portfolioCats.set(id, updated);
    return updated;
  }
  async deletePortfolioCategory(id, userId) {
    const existing = this.portfolioCats.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.portfolioCats.delete(id);
  }
  // Portfolio Holdings
  async createPortfolioHolding(userId, holding) {
    const id = randomUUID();
    const quantity = holding.quantity ?? 1;
    const newHolding = {
      id,
      userId,
      itemId: holding.itemId,
      itemName: holding.itemName,
      itemIcon: holding.itemIcon ?? null,
      quantity,
      avgBuyPrice: holding.avgBuyPrice,
      totalCost: holding.avgBuyPrice * quantity,
      realizedProfit: 0,
      realizedLoss: 0,
      categoryId: holding.categoryId ?? null,
      source: holding.source ?? "manual",
      notes: holding.notes ?? null,
      lastValuedPrice: null,
      lastValuedAt: null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.portfolioHolds.set(id, newHolding);
    return newHolding;
  }
  async getPortfolioHoldings(userId) {
    return Array.from(this.portfolioHolds.values()).filter((h) => h.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  async getPortfolioHolding(id) {
    return this.portfolioHolds.get(id);
  }
  async updatePortfolioHolding(id, userId, holding) {
    const existing = this.portfolioHolds.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    const updated = { ...existing, ...holding, updatedAt: /* @__PURE__ */ new Date() };
    this.portfolioHolds.set(id, updated);
    return updated;
  }
  async deletePortfolioHolding(id, userId) {
    const existing = this.portfolioHolds.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.portfolioHolds.delete(id);
  }
  // Portfolio Holding Transactions
  holdingTxs = /* @__PURE__ */ new Map();
  async createHoldingTransaction(userId, tx) {
    const id = randomUUID();
    const totalValue = tx.pricePerUnit * tx.quantity;
    const newTx = {
      id,
      holdingId: tx.holdingId,
      userId,
      transactionType: tx.transactionType,
      quantity: tx.quantity,
      pricePerUnit: tx.pricePerUnit,
      totalValue,
      fees: tx.fees ?? 0,
      profitLoss: null,
      notes: tx.notes ?? null,
      transactionDate: tx.transactionDate,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.holdingTxs.set(id, newTx);
    return newTx;
  }
  async getHoldingTransactions(holdingId, userId) {
    return Array.from(this.holdingTxs.values()).filter((tx) => tx.holdingId === holdingId && tx.userId === userId).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }
  async getHoldingTransaction(id) {
    return this.holdingTxs.get(id);
  }
  async deleteHoldingTransaction(id, userId) {
    const existing = this.holdingTxs.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.holdingTxs.delete(id);
  }
  // Portfolio Snapshots
  async createPortfolioSnapshot(userId, snapshot) {
    const id = randomUUID();
    const newSnap = {
      id,
      userId,
      totalValue: snapshot.totalValue,
      totalCost: snapshot.totalCost,
      totalProfit: snapshot.totalProfit,
      itemCount: snapshot.itemCount,
      snapshotDate: snapshot.snapshotDate,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.portfolioSnaps.set(id, newSnap);
    return newSnap;
  }
  async getPortfolioSnapshots(userId, limit) {
    const snaps = Array.from(this.portfolioSnaps.values()).filter((s) => s.userId === userId).sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());
    return limit ? snaps.slice(0, limit) : snaps;
  }
  async createSnapshotItems(snapshotId, items) {
    for (const item of items) {
      const id = randomUUID();
      this.portfolioSnapItems.set(id, { id, ...item });
    }
  }
  async getSnapshotItems(snapshotId) {
    return Array.from(this.portfolioSnapItems.values()).filter((i) => i.snapshotId === snapshotId);
  }
  // Transaction Recording (MemStorage - limited support)
  transactions = /* @__PURE__ */ new Map();
  volumeDaily = /* @__PURE__ */ new Map();
  sessions = /* @__PURE__ */ new Map();
  async recordTransaction(tx) {
    const id = randomUUID();
    const totalValue = tx.price * tx.quantity;
    const record = {
      id,
      flipId: tx.flipId ?? null,
      userId: tx.userId,
      itemId: tx.itemId,
      itemName: tx.itemName,
      transactionType: tx.transactionType,
      price: tx.price,
      quantity: tx.quantity,
      totalValue,
      taxPaid: tx.taxPaid ?? 0,
      strategyTag: tx.strategyTag ?? null,
      transactionDate: tx.transactionDate,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.transactions.set(id, record);
    return record;
  }
  async getTransactionsByItem(itemId, limit) {
    const txs = Array.from(this.transactions.values()).filter((t) => t.itemId === itemId).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
    return limit ? txs.slice(0, limit) : txs;
  }
  async getAllTransactions(limit) {
    const txs = Array.from(this.transactions.values()).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
    return limit ? txs.slice(0, limit) : txs;
  }
  async updateItemVolume(itemId, itemName, date, txType, price, quantity) {
    const dateKey = date.toISOString().split("T")[0];
    const key = `${itemId}-${dateKey}`;
    const existing = this.volumeDaily.get(key);
    const totalValue = price * quantity;
    if (existing) {
      existing.transactionCount = (existing.transactionCount || 0) + 1;
      existing.totalQuantity = (existing.totalQuantity || 0) + quantity;
      existing.totalValue = (existing.totalValue || 0) + totalValue;
      if (txType === "buy") existing.buyCount = (existing.buyCount || 0) + 1;
      else existing.sellCount = (existing.sellCount || 0) + 1;
      existing.avgPrice = Math.round(existing.totalValue / existing.totalQuantity);
      existing.minPrice = existing.minPrice ? Math.min(existing.minPrice, price) : price;
      existing.maxPrice = existing.maxPrice ? Math.max(existing.maxPrice, price) : price;
      existing.updatedAt = /* @__PURE__ */ new Date();
    } else {
      this.volumeDaily.set(key, {
        id: randomUUID(),
        itemId,
        itemName,
        date,
        transactionCount: 1,
        totalQuantity: quantity,
        totalValue,
        avgPrice: price,
        minPrice: price,
        maxPrice: price,
        buyCount: txType === "buy" ? 1 : 0,
        sellCount: txType === "sell" ? 1 : 0,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      });
    }
  }
  async getItemVolumeDaily(itemId, startDate, endDate) {
    return Array.from(this.volumeDaily.values()).filter((v) => v.itemId === itemId && v.date >= startDate && v.date <= endDate).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  async getItemVolumeWeekly(itemId) {
    return [];
  }
  async getItemVolumeMonthly(itemId) {
    return [];
  }
  async updateUserHeartbeat(userId) {
    const existing = this.sessions.get(userId);
    const now = /* @__PURE__ */ new Date();
    if (existing) {
      existing.lastHeartbeat = now;
      existing.status = "online";
    } else {
      this.sessions.set(userId, {
        id: randomUUID(),
        userId,
        lastHeartbeat: now,
        status: "online",
        createdAt: now
      });
    }
    const user = this.users.get(userId);
    if (user) user.lastSeenAt = now;
  }
  async updateUserLastSeen(userId) {
    const user = this.users.get(userId);
    if (user) user.lastSeenAt = /* @__PURE__ */ new Date();
  }
  async getUserSession(userId) {
    return this.sessions.get(userId);
  }
  async getAllUserSessions() {
    return Array.from(this.sessions.values());
  }
  async getOnlineUsers(thresholdMs = 6e4) {
    const now = Date.now();
    const onlineUserIds = Array.from(this.sessions.values()).filter((s) => s.lastHeartbeat && now - new Date(s.lastHeartbeat).getTime() < thresholdMs).map((s) => s.userId);
    return Array.from(this.users.values()).filter((u) => onlineUserIds.includes(u.id));
  }
  async getAllUsers() {
    return Array.from(this.users.values());
  }
  async setUserAdmin(userId, isAdmin) {
    const user = this.users.get(userId);
    if (!user) return void 0;
    user.isAdmin = isAdmin;
    return user;
  }
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find((u) => u.email === email);
  }
  async getUserByDiscordId(discordId) {
    return Array.from(this.users.values()).find((u) => u.discordId === discordId);
  }
  async linkDiscordId(userId, discordId) {
    const user = this.users.get(userId);
    if (user) {
      user.discordId = discordId;
      this.users.set(userId, user);
    }
  }
  // RS Accounts (Alt management) - MemStorage
  rsAccountsStore = /* @__PURE__ */ new Map();
  async createRsAccount(userId, account) {
    const id = randomUUID();
    if (account.isDefault) {
      Array.from(this.rsAccountsStore.values()).forEach((acc) => {
        if (acc.userId === userId) acc.isDefault = false;
      });
    }
    const newAccount = {
      id,
      userId,
      displayName: account.displayName,
      accountType: account.accountType ?? "Main",
      isDefault: account.isDefault ?? false,
      preferredWorld: account.preferredWorld ?? null,
      notes: account.notes ?? null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.rsAccountsStore.set(id, newAccount);
    return newAccount;
  }
  async getRsAccounts(userId) {
    return Array.from(this.rsAccountsStore.values()).filter((a) => a.userId === userId).sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  }
  async getRsAccount(id) {
    return this.rsAccountsStore.get(id);
  }
  async updateRsAccount(id, userId, account) {
    const existing = this.rsAccountsStore.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    const updated = {
      ...existing,
      ...account,
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.rsAccountsStore.set(id, updated);
    return updated;
  }
  async deleteRsAccount(id, userId) {
    const existing = this.rsAccountsStore.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.rsAccountsStore.delete(id);
  }
  async setDefaultRsAccount(id, userId) {
    const existing = this.rsAccountsStore.get(id);
    if (!existing || existing.userId !== userId) return void 0;
    Array.from(this.rsAccountsStore.values()).forEach((acc) => {
      if (acc.userId === userId) acc.isDefault = false;
    });
    existing.isDefault = true;
    existing.updatedAt = /* @__PURE__ */ new Date();
    return existing;
  }
  // Recipe stub implementations for MemStorage
  async createRecipe() {
    throw new Error("Not implemented");
  }
  async getRecipes() {
    return [];
  }
  async getRecipe() {
    return void 0;
  }
  async getRecipeWithComponents() {
    return void 0;
  }
  async updateRecipe() {
    return void 0;
  }
  async deleteRecipe() {
    return false;
  }
  async archiveRecipe() {
    return void 0;
  }
  async createRecipeComponent() {
    throw new Error("Not implemented");
  }
  async getRecipeComponents() {
    return [];
  }
  async updateRecipeComponent() {
    return void 0;
  }
  async deleteRecipeComponent() {
    return false;
  }
  async createRecipeRun() {
    throw new Error("Not implemented");
  }
  async getRecipeRuns() {
    return [];
  }
  async getRecipeRun() {
    return void 0;
  }
  async getRecipeRunWithDetails() {
    return void 0;
  }
  async updateRecipeRun() {
    return void 0;
  }
  async deleteRecipeRun() {
    return false;
  }
  async createRecipeRunComponent() {
    throw new Error("Not implemented");
  }
  async getRecipeRunComponents() {
    return [];
  }
  async updateRecipeRunComponent() {
    return void 0;
  }
  async deleteRecipeRunComponent() {
    return false;
  }
};
var DatabaseStorage = class {
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || void 0;
  }
  async upsertUser(userData) {
    if (userData.email) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail.length > 0 && existingByEmail[0].id !== userData.id) {
        const [updated] = await db.update(users).set({
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, existingByEmail[0].id)).returning();
        return updated;
      }
    }
    const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  }
  async updateUserProfile(userId, data) {
    const [updated] = await db.update(users).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId)).returning();
    return updated || void 0;
  }
  async createFlip(userId, flip) {
    const [newFlip] = await db.insert(flips).values({ ...flip, userId }).returning();
    return newFlip;
  }
  async getFlips(userId) {
    return await db.select().from(flips).where(and(eq(flips.userId, userId), isNull(flips.deletedAt))).orderBy(desc(flips.buyDate));
  }
  async getAllFlips() {
    const result = await db.select({
      flip: flips,
      user: {
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email
      }
    }).from(flips).leftJoin(users, eq(flips.userId, users.id)).where(isNull(flips.deletedAt)).orderBy(desc(flips.buyDate));
    return result.map((row) => ({
      ...row.flip,
      user: row.user || void 0
    }));
  }
  async getFlip(id) {
    const [flip] = await db.select().from(flips).where(eq(flips.id, id));
    return flip || void 0;
  }
  async updateFlip(id, userId, flipUpdate, skipOwnerCheck) {
    const cleanedUpdate = Object.fromEntries(
      Object.entries(flipUpdate).filter(([_, value]) => value !== void 0)
    );
    if (Object.keys(cleanedUpdate).length === 0) {
      return this.getFlip(id);
    }
    const whereClause = skipOwnerCheck ? eq(flips.id, id) : and(eq(flips.id, id), eq(flips.userId, userId));
    const [updatedFlip] = await db.update(flips).set(cleanedUpdate).where(whereClause).returning();
    return updatedFlip || void 0;
  }
  async deleteFlip(id, userId) {
    const result = await db.delete(flips).where(and(eq(flips.id, id), eq(flips.userId, userId))).returning();
    return result.length > 0;
  }
  async softDeleteFlip(id, userId) {
    const [updatedFlip] = await db.update(flips).set({ deletedAt: /* @__PURE__ */ new Date() }).where(and(eq(flips.id, id), eq(flips.userId, userId))).returning();
    return updatedFlip || void 0;
  }
  async restoreFlip(id, userId) {
    const [updatedFlip] = await db.update(flips).set({ deletedAt: null }).where(and(eq(flips.id, id), eq(flips.userId, userId))).returning();
    return updatedFlip || void 0;
  }
  async getUserFlipsByItemId(userId, itemId) {
    return await db.select().from(flips).where(and(eq(flips.userId, userId), eq(flips.itemId, itemId), isNull(flips.deletedAt))).orderBy(desc(flips.buyDate));
  }
  async createWatchlistItem(userId, item) {
    const [newItem] = await db.insert(watchlist).values({ ...item, userId }).returning();
    return newItem;
  }
  async getWatchlist(userId) {
    return await db.select().from(watchlist).where(eq(watchlist.userId, userId)).orderBy(desc(watchlist.createdAt));
  }
  async getWatchlistItem(id) {
    const [item] = await db.select().from(watchlist).where(eq(watchlist.id, id));
    return item || void 0;
  }
  async updateWatchlistItem(id, userId, item) {
    const [updatedItem] = await db.update(watchlist).set(item).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId))).returning();
    return updatedItem || void 0;
  }
  async deleteWatchlistItem(id, userId) {
    const result = await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId))).returning();
    return result.length > 0;
  }
  async createPriceAlert(userId, alert) {
    const [newAlert] = await db.insert(priceAlerts).values({ ...alert, userId }).returning();
    return newAlert;
  }
  async getPriceAlerts(userId) {
    return await db.select().from(priceAlerts).where(eq(priceAlerts.userId, userId)).orderBy(desc(priceAlerts.createdAt));
  }
  async getPriceAlert(id) {
    const [alert] = await db.select().from(priceAlerts).where(eq(priceAlerts.id, id));
    return alert || void 0;
  }
  async updatePriceAlert(id, userId, alert) {
    const [updatedAlert] = await db.update(priceAlerts).set(alert).where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId))).returning();
    return updatedAlert || void 0;
  }
  async deletePriceAlert(id, userId) {
    const result = await db.delete(priceAlerts).where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId))).returning();
    return result.length > 0;
  }
  async createFavorite(userId, favorite) {
    const [newFavorite] = await db.insert(favorites).values({ ...favorite, userId }).returning();
    return newFavorite;
  }
  async getFavorites(userId) {
    return await db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
  }
  async deleteFavorite(id, userId) {
    const result = await db.delete(favorites).where(and(eq(favorites.id, id), eq(favorites.userId, userId))).returning();
    return result.length > 0;
  }
  async createProfitGoal(userId, goal) {
    const [newGoal] = await db.insert(profitGoals).values({ ...goal, userId }).returning();
    return newGoal;
  }
  async getProfitGoals(userId) {
    return await db.select().from(profitGoals).where(eq(profitGoals.userId, userId)).orderBy(desc(profitGoals.createdAt));
  }
  async updateProfitGoal(id, userId, goal) {
    const [updatedGoal] = await db.update(profitGoals).set({ ...goal, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(profitGoals.id, id), eq(profitGoals.userId, userId))).returning();
    return updatedGoal || void 0;
  }
  async deleteProfitGoal(id, userId) {
    const result = await db.delete(profitGoals).where(and(eq(profitGoals.id, id), eq(profitGoals.userId, userId))).returning();
    return result.length > 0;
  }
  // Portfolio Categories
  async createPortfolioCategory(userId, category) {
    const [newCat] = await db.insert(portfolioCategories).values({ ...category, userId }).returning();
    return newCat;
  }
  async getPortfolioCategories(userId) {
    return await db.select().from(portfolioCategories).where(eq(portfolioCategories.userId, userId)).orderBy(portfolioCategories.name);
  }
  async updatePortfolioCategory(id, userId, category) {
    const [updatedCat] = await db.update(portfolioCategories).set(category).where(and(eq(portfolioCategories.id, id), eq(portfolioCategories.userId, userId))).returning();
    return updatedCat || void 0;
  }
  async deletePortfolioCategory(id, userId) {
    const result = await db.delete(portfolioCategories).where(and(eq(portfolioCategories.id, id), eq(portfolioCategories.userId, userId))).returning();
    return result.length > 0;
  }
  // Portfolio Holdings
  async createPortfolioHolding(userId, holding) {
    const [newHolding] = await db.insert(portfolioHoldings).values({ ...holding, userId }).returning();
    return newHolding;
  }
  async getPortfolioHoldings(userId) {
    return await db.select().from(portfolioHoldings).where(eq(portfolioHoldings.userId, userId)).orderBy(desc(portfolioHoldings.createdAt));
  }
  async getPortfolioHolding(id) {
    const [holding] = await db.select().from(portfolioHoldings).where(eq(portfolioHoldings.id, id));
    return holding || void 0;
  }
  async updatePortfolioHolding(id, userId, holding) {
    const [updatedHolding] = await db.update(portfolioHoldings).set({ ...holding, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId))).returning();
    return updatedHolding || void 0;
  }
  async deletePortfolioHolding(id, userId) {
    const result = await db.delete(portfolioHoldings).where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId))).returning();
    return result.length > 0;
  }
  // Portfolio Holding Transactions
  async createHoldingTransaction(userId, tx) {
    const totalValue = tx.pricePerUnit * tx.quantity;
    const [newTx] = await db.insert(portfolioHoldingTransactions).values({
      holdingId: tx.holdingId,
      userId,
      transactionType: tx.transactionType,
      quantity: tx.quantity,
      pricePerUnit: tx.pricePerUnit,
      totalValue,
      fees: tx.fees ?? 0,
      notes: tx.notes,
      transactionDate: tx.transactionDate
    }).returning();
    return newTx;
  }
  async getHoldingTransactions(holdingId, userId) {
    return await db.select().from(portfolioHoldingTransactions).where(and(
      eq(portfolioHoldingTransactions.holdingId, holdingId),
      eq(portfolioHoldingTransactions.userId, userId)
    )).orderBy(desc(portfolioHoldingTransactions.transactionDate));
  }
  async getHoldingTransaction(id) {
    const [tx] = await db.select().from(portfolioHoldingTransactions).where(eq(portfolioHoldingTransactions.id, id));
    return tx || void 0;
  }
  async deleteHoldingTransaction(id, userId) {
    const result = await db.delete(portfolioHoldingTransactions).where(and(
      eq(portfolioHoldingTransactions.id, id),
      eq(portfolioHoldingTransactions.userId, userId)
    )).returning();
    return result.length > 0;
  }
  // Portfolio Snapshots
  async createPortfolioSnapshot(userId, snapshot) {
    const [newSnap] = await db.insert(portfolioSnapshots).values({ ...snapshot, userId }).returning();
    return newSnap;
  }
  async getPortfolioSnapshots(userId, limit) {
    const query = db.select().from(portfolioSnapshots).where(eq(portfolioSnapshots.userId, userId)).orderBy(desc(portfolioSnapshots.snapshotDate));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
  async createSnapshotItems(snapshotId, items) {
    if (items.length === 0) return;
    await db.insert(portfolioSnapshotItems).values(items);
  }
  async getSnapshotItems(snapshotId) {
    return await db.select().from(portfolioSnapshotItems).where(eq(portfolioSnapshotItems.snapshotId, snapshotId));
  }
  // Transaction Recording (for LLM training)
  async recordTransaction(tx) {
    const totalValue = tx.price * tx.quantity;
    const [record] = await db.insert(flipTransactions).values({
      flipId: tx.flipId,
      userId: tx.userId,
      itemId: tx.itemId,
      itemName: tx.itemName,
      transactionType: tx.transactionType,
      price: tx.price,
      quantity: tx.quantity,
      totalValue,
      taxPaid: tx.taxPaid ?? 0,
      strategyTag: tx.strategyTag,
      transactionDate: tx.transactionDate
    }).returning();
    return record;
  }
  async getTransactionsByItem(itemId, limit) {
    const query = db.select().from(flipTransactions).where(eq(flipTransactions.itemId, itemId)).orderBy(desc(flipTransactions.transactionDate));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
  async getAllTransactions(limit) {
    const query = db.select().from(flipTransactions).orderBy(desc(flipTransactions.transactionDate));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
  async updateItemVolume(itemId, itemName, date, txType, price, quantity) {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);
    const totalValue = price * quantity;
    const [existing] = await db.select().from(itemVolumeDaily).where(and(
      eq(itemVolumeDaily.itemId, itemId),
      gte(itemVolumeDaily.date, dateStart),
      lte(itemVolumeDaily.date, dateEnd)
    ));
    if (existing) {
      await db.update(itemVolumeDaily).set({
        transactionCount: (existing.transactionCount || 0) + 1,
        totalQuantity: (existing.totalQuantity || 0) + quantity,
        totalValue: (existing.totalValue || 0) + totalValue,
        avgPrice: Math.round(((existing.totalValue || 0) + totalValue) / ((existing.totalQuantity || 0) + quantity)),
        minPrice: existing.minPrice ? Math.min(existing.minPrice, price) : price,
        maxPrice: existing.maxPrice ? Math.max(existing.maxPrice, price) : price,
        buyCount: txType === "buy" ? (existing.buyCount || 0) + 1 : existing.buyCount,
        sellCount: txType === "sell" ? (existing.sellCount || 0) + 1 : existing.sellCount,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(itemVolumeDaily.id, existing.id));
    } else {
      await db.insert(itemVolumeDaily).values({
        itemId,
        itemName,
        date: dateStart,
        transactionCount: 1,
        totalQuantity: quantity,
        totalValue,
        avgPrice: price,
        minPrice: price,
        maxPrice: price,
        buyCount: txType === "buy" ? 1 : 0,
        sellCount: txType === "sell" ? 1 : 0
      });
    }
  }
  async getItemVolumeDaily(itemId, startDate, endDate) {
    return await db.select().from(itemVolumeDaily).where(and(
      eq(itemVolumeDaily.itemId, itemId),
      gte(itemVolumeDaily.date, startDate),
      lte(itemVolumeDaily.date, endDate)
    )).orderBy(desc(itemVolumeDaily.date));
  }
  async getItemVolumeWeekly(itemId) {
    const result = await db.execute(sql2`
      SELECT 
        to_char(date_trunc('week', date), 'YYYY-WW') as week,
        SUM(transaction_count)::int as "transactionCount",
        SUM(total_quantity)::int as "totalQuantity",
        SUM(total_value)::bigint as "totalValue"
      FROM item_volume_daily
      WHERE item_id = ${itemId}
      GROUP BY date_trunc('week', date)
      ORDER BY week DESC
      LIMIT 12
    `);
    return result.rows;
  }
  async getItemVolumeMonthly(itemId) {
    const result = await db.execute(sql2`
      SELECT 
        to_char(date_trunc('month', date), 'YYYY-MM') as month,
        SUM(transaction_count)::int as "transactionCount",
        SUM(total_quantity)::int as "totalQuantity",
        SUM(total_value)::bigint as "totalValue"
      FROM item_volume_daily
      WHERE item_id = ${itemId}
      GROUP BY date_trunc('month', date)
      ORDER BY month DESC
      LIMIT 12
    `);
    return result.rows;
  }
  // User Presence & Admin
  async updateUserHeartbeat(userId) {
    const now = /* @__PURE__ */ new Date();
    const [existing] = await db.select().from(userSessions).where(eq(userSessions.userId, userId));
    if (existing) {
      await db.update(userSessions).set({ lastHeartbeat: now, status: "online" }).where(eq(userSessions.userId, userId));
    } else {
      await db.insert(userSessions).values({
        userId,
        lastHeartbeat: now,
        status: "online"
      });
    }
    await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId));
  }
  async updateUserLastSeen(userId) {
    await db.update(users).set({ lastSeenAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
  }
  async getUserSession(userId) {
    const [session2] = await db.select().from(userSessions).where(eq(userSessions.userId, userId));
    return session2 || void 0;
  }
  async getAllUserSessions() {
    return await db.select().from(userSessions);
  }
  async getOnlineUsers(thresholdMs = 6e4) {
    const threshold = new Date(Date.now() - thresholdMs);
    const sessions2 = await db.select().from(userSessions).where(gte(userSessions.lastHeartbeat, threshold));
    if (sessions2.length === 0) return [];
    const userIds = sessions2.map((s) => s.userId);
    const onlineUsers = await db.select().from(users).where(inArray(users.id, userIds));
    return onlineUsers;
  }
  async getAllUsers() {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }
  async setUserAdmin(userId, isAdmin) {
    const [user] = await db.update(users).set({ isAdmin }).where(eq(users.id, userId)).returning();
    return user || void 0;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || void 0;
  }
  async getUserByDiscordId(discordId) {
    const [user] = await db.select().from(users).where(eq(users.discordId, discordId));
    return user || void 0;
  }
  async linkDiscordId(userId, discordId) {
    await db.update(users).set({ discordId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
  }
  // RS Accounts (Alt management) - DatabaseStorage
  async createRsAccount(userId, account) {
    if (account.isDefault) {
      await db.update(rsAccounts).set({ isDefault: false }).where(eq(rsAccounts.userId, userId));
    }
    const [newAccount] = await db.insert(rsAccounts).values({ ...account, userId }).returning();
    return newAccount;
  }
  async getRsAccounts(userId) {
    return await db.select().from(rsAccounts).where(eq(rsAccounts.userId, userId)).orderBy(desc(rsAccounts.isDefault), desc(rsAccounts.createdAt));
  }
  async getRsAccount(id) {
    const [account] = await db.select().from(rsAccounts).where(eq(rsAccounts.id, id));
    return account || void 0;
  }
  async updateRsAccount(id, userId, account) {
    const [updated] = await db.update(rsAccounts).set({ ...account, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(rsAccounts.id, id), eq(rsAccounts.userId, userId))).returning();
    return updated || void 0;
  }
  async deleteRsAccount(id, userId) {
    const result = await db.delete(rsAccounts).where(and(eq(rsAccounts.id, id), eq(rsAccounts.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async setDefaultRsAccount(id, userId) {
    await db.update(rsAccounts).set({ isDefault: false }).where(eq(rsAccounts.userId, userId));
    const [account] = await db.update(rsAccounts).set({ isDefault: true, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(rsAccounts.id, id), eq(rsAccounts.userId, userId))).returning();
    return account || void 0;
  }
  // Recipes - DatabaseStorage
  async createRecipe(userId, recipe) {
    const [newRecipe] = await db.insert(recipes).values({ ...recipe, userId }).returning();
    return newRecipe;
  }
  async getRecipes(userId) {
    return await db.select().from(recipes).where(and(eq(recipes.userId, userId), eq(recipes.isArchived, false))).orderBy(desc(recipes.createdAt));
  }
  async getRecipe(id) {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id));
    return recipe || void 0;
  }
  async getRecipeWithComponents(id) {
    const recipe = await this.getRecipe(id);
    if (!recipe) return void 0;
    const components = await this.getRecipeComponents(id);
    return { ...recipe, components };
  }
  async updateRecipe(id, userId, recipe) {
    const [updated] = await db.update(recipes).set({ ...recipe, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(recipes.id, id), eq(recipes.userId, userId))).returning();
    return updated || void 0;
  }
  async deleteRecipe(id, userId) {
    await db.delete(recipeComponents).where(eq(recipeComponents.recipeId, id));
    const runs = await db.select().from(recipeRuns).where(eq(recipeRuns.recipeId, id));
    for (const run of runs) {
      await db.delete(recipeRunComponents).where(eq(recipeRunComponents.runId, run.id));
    }
    await db.delete(recipeRuns).where(eq(recipeRuns.recipeId, id));
    const result = await db.delete(recipes).where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  async archiveRecipe(id, userId) {
    const [archived] = await db.update(recipes).set({ isArchived: true, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(recipes.id, id), eq(recipes.userId, userId))).returning();
    return archived || void 0;
  }
  // Recipe Components - DatabaseStorage
  async createRecipeComponent(component) {
    const [newComponent] = await db.insert(recipeComponents).values(component).returning();
    return newComponent;
  }
  async getRecipeComponents(recipeId) {
    return await db.select().from(recipeComponents).where(eq(recipeComponents.recipeId, recipeId));
  }
  async updateRecipeComponent(id, component) {
    const [updated] = await db.update(recipeComponents).set(component).where(eq(recipeComponents.id, id)).returning();
    return updated || void 0;
  }
  async deleteRecipeComponent(id) {
    const result = await db.delete(recipeComponents).where(eq(recipeComponents.id, id));
    return (result.rowCount ?? 0) > 0;
  }
  // Recipe Runs - DatabaseStorage
  async createRecipeRun(userId, run) {
    const [newRun] = await db.insert(recipeRuns).values({ ...run, userId }).returning();
    return newRun;
  }
  async getRecipeRuns(userId) {
    return await db.select().from(recipeRuns).where(eq(recipeRuns.userId, userId)).orderBy(desc(recipeRuns.startedAt));
  }
  async getRecipeRun(id) {
    const [run] = await db.select().from(recipeRuns).where(eq(recipeRuns.id, id));
    return run || void 0;
  }
  async getRecipeRunWithDetails(id) {
    const run = await this.getRecipeRun(id);
    if (!run) return void 0;
    const recipe = await this.getRecipe(run.recipeId);
    if (!recipe) return void 0;
    const runComponents = await this.getRecipeRunComponents(id);
    const recipeComps = await this.getRecipeComponents(run.recipeId);
    const componentsWithDetails = await Promise.all(
      runComponents.map(async (rc) => {
        const component = recipeComps.find((c) => c.id === rc.componentId);
        const rsAccount = rc.rsAccountId ? await this.getRsAccount(rc.rsAccountId) : null;
        return {
          ...rc,
          component,
          rsAccount
        };
      })
    );
    return {
      ...run,
      recipe,
      components: componentsWithDetails
    };
  }
  async updateRecipeRun(id, userId, run) {
    const [updated] = await db.update(recipeRuns).set(run).where(and(eq(recipeRuns.id, id), eq(recipeRuns.userId, userId))).returning();
    return updated || void 0;
  }
  async deleteRecipeRun(id, userId) {
    await db.delete(recipeRunComponents).where(eq(recipeRunComponents.runId, id));
    const result = await db.delete(recipeRuns).where(and(eq(recipeRuns.id, id), eq(recipeRuns.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }
  // Recipe Run Components - DatabaseStorage
  async createRecipeRunComponent(component) {
    const [newComponent] = await db.insert(recipeRunComponents).values(component).returning();
    return newComponent;
  }
  async getRecipeRunComponents(runId) {
    return await db.select().from(recipeRunComponents).where(eq(recipeRunComponents.runId, runId));
  }
  async updateRecipeRunComponent(id, component) {
    const [updated] = await db.update(recipeRunComponents).set(component).where(eq(recipeRunComponents.id, id)).returning();
    return updated || void 0;
  }
  async deleteRecipeRunComponent(id) {
    const result = await db.delete(recipeRunComponents).where(eq(recipeRunComponents.id, id));
    return (result.rowCount ?? 0) > 0;
  }
};
async function createStorage() {
  try {
    await db.select().from(users).limit(1);
    console.log("[storage] Database connection successful, using DatabaseStorage");
    return new DatabaseStorage();
  } catch (error) {
    console.warn("[storage] Database unavailable, falling back to MemStorage");
    console.warn("[storage] Data will not persist across restarts");
    return new MemStorage();
  }
}
var storage = new MemStorage();
createStorage().then((s) => {
  storage = s;
});

// server/technical-indicators.ts
function calculateObservableRange(history, days) {
  if (history.length === 0) return null;
  const recent = history.slice(-days);
  if (recent.length < 2) return null;
  const prices = recent.map((h) => h.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const current = prices[prices.length - 1];
  if (low === 0) return null;
  const spreadPct = Math.round((high - low) / low * 1e4) / 100;
  const range = high - low;
  const percentile = range > 0 ? Math.round((current - low) / range * 100) : 50;
  return { low, high, current, spreadPct, percentile };
}
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const recent = prices.slice(-period - 1);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const change = recent[i] - recent[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const recent = prices.slice(-period);
  return Math.round(recent.reduce((a, b) => a + b, 0) / period);
}
function calculateVolatility(prices) {
  if (prices.length < 2) return 0;
  const recent = prices.slice(-30);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  if (mean === 0) return 0;
  const squaredDiffs = recent.map((p) => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / recent.length;
  const stdDev = Math.sqrt(variance);
  return Math.round(stdDev / mean * 1e4) / 100;
}
function findSupportResistance(prices) {
  if (prices.length < 10) return { support: null, resistance: null };
  const recent = prices.slice(-30);
  const sorted = [...recent].sort((a, b) => a - b);
  const q1Index = Math.floor(sorted.length * 0.1);
  const q3Index = Math.floor(sorted.length * 0.9);
  return {
    support: sorted[q1Index],
    resistance: sorted[q3Index]
  };
}
function calculateValueGap(currentPrice, sma30, sma200) {
  const anchors = [];
  if (sma30 !== null) anchors.push(sma30);
  if (sma200 !== null) anchors.push(sma200);
  if (anchors.length === 0) return null;
  const fairValue = Math.round(anchors.reduce((a, b) => a + b, 0) / anchors.length);
  if (fairValue === 0) return null;
  const gapPct = Math.round((currentPrice - fairValue) / fairValue * 1e4) / 100;
  let gapDirection = "fair";
  if (gapPct < -3) gapDirection = "undervalued";
  else if (gapPct > 3) gapDirection = "overvalued";
  let signal = "hold";
  if (gapPct < -10) signal = "strong_buy";
  else if (gapPct < -3) signal = "buy";
  else if (gapPct > 10) signal = "strong_sell";
  else if (gapPct > 3) signal = "sell";
  return { fairValue, currentPrice, gapPct, gapDirection, signal };
}
function calculateTechnicalIndicators(history) {
  const prices = history.map((h) => h.price);
  const rsi14 = calculateRSI(prices);
  const sma7 = calculateSMA(prices, 7);
  const sma30 = calculateSMA(prices, 30);
  const sma200 = calculateSMA(prices, 200);
  let smaCrossover = "neutral";
  if (sma7 !== null && sma30 !== null) {
    const diff = (sma7 - sma30) / sma30;
    if (diff > 0.01) smaCrossover = "bullish";
    else if (diff < -0.01) smaCrossover = "bearish";
  }
  const volatilityPct = calculateVolatility(prices);
  let priceVsAvg30 = 0;
  if (sma30 !== null && prices.length > 0) {
    const currentPrice2 = prices[prices.length - 1];
    priceVsAvg30 = Math.round((currentPrice2 - sma30) / sma30 * 1e4) / 100;
  }
  const { support, resistance } = findSupportResistance(prices);
  const currentPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  const valueGap = calculateValueGap(currentPrice, sma30, sma200);
  return {
    rsi14,
    sma7,
    sma30,
    sma200,
    smaCrossover,
    volatilityPct,
    priceVsAvg30,
    support,
    resistance,
    valueGap
  };
}
function getPriceTier(price) {
  if (price < 1e3) return "low";
  if (price < 1e6) return "mid";
  if (price < 1e8) return "high";
  return "ultra";
}
var TIER_MARGINS = {
  low: { base: 0.075, min: 0.05, max: 0.1 },
  mid: { base: 0.035, min: 0.02, max: 0.05 },
  high: { base: 0.02, min: 0.01, max: 0.03 },
  ultra: { base: 0.01, min: 5e-3, max: 0.015 }
};
function calculateSmartPricing(currentPrice, indicators, tradeStats) {
  const tier = getPriceTier(currentPrice);
  const tierConfig = TIER_MARGINS[tier];
  let marginPct = tierConfig.base;
  if (indicators) {
    if (indicators.volatilityPct > 5) {
      marginPct *= 1.3;
    } else if (indicators.volatilityPct > 3) {
      marginPct *= 1.15;
    } else if (indicators.volatilityPct < 1) {
      marginPct *= 0.85;
    }
    if (indicators.rsi14 !== null) {
      if (indicators.rsi14 < 30) {
        marginPct *= 1.2;
      } else if (indicators.rsi14 > 70) {
        marginPct *= 0.85;
      }
    }
    if (indicators.smaCrossover === "bullish") {
      marginPct *= 1.1;
    } else if (indicators.smaCrossover === "bearish") {
      marginPct *= 0.9;
    }
  }
  let confidence = "low";
  if (tradeStats && tradeStats.tradeCount >= 3) {
    const actualMargin = tradeStats.avgActualMarginPct / 100;
    if (actualMargin > 0) {
      const blendWeight = Math.min(tradeStats.tradeCount / 10, 0.7);
      marginPct = marginPct * (1 - blendWeight) + actualMargin * blendWeight;
    }
    confidence = tradeStats.tradeCount >= 10 ? "high" : "medium";
  } else if (indicators && indicators.rsi14 !== null) {
    confidence = "medium";
  }
  marginPct = Math.max(tierConfig.min, Math.min(tierConfig.max, marginPct));
  const halfMargin = marginPct / 2;
  const suggestedBuyPrice = Math.round(currentPrice * (1 - halfMargin));
  const suggestedSellPrice = Math.round(currentPrice * (1 + halfMargin));
  return {
    suggestedBuyPrice,
    suggestedSellPrice,
    suggestedMarginPct: Math.round(marginPct * 1e4) / 100,
    priceTier: tier,
    confidence
  };
}
function calculateTradeHistoryStats(flips2, suggestedMarginPct) {
  const completedFlips = flips2.filter((f) => f.sellPrice !== null && f.sellDate !== null);
  if (completedFlips.length === 0) {
    return {
      tradeCount: 0,
      avgActualMarginPct: 0,
      avgActualROI: 0,
      avgHoldTimeHours: 0,
      winRate: 0,
      lastTradeDate: null,
      modelGap: 0
    };
  }
  let totalMarginPct = 0;
  let totalROI = 0;
  let totalHoldMs = 0;
  let wins = 0;
  for (const flip of completedFlips) {
    const buy = Number(flip.buyPrice);
    const sell = Number(flip.sellPrice);
    const margin = sell - buy;
    const marginPct = buy > 0 ? margin / buy * 100 : 0;
    totalMarginPct += marginPct;
    const taxPerItem = sell <= 49 ? 0 : Math.floor(sell * 0.02);
    const netProfit = margin * flip.quantity - taxPerItem * flip.quantity;
    const investment = buy * flip.quantity;
    const roi = investment > 0 ? netProfit / investment * 100 : 0;
    totalROI += roi;
    if (netProfit > 0) wins++;
    const buyDate = new Date(flip.buyDate);
    const sellDate = new Date(flip.sellDate);
    totalHoldMs += sellDate.getTime() - buyDate.getTime();
  }
  const count = completedFlips.length;
  const avgActualMarginPct = totalMarginPct / count;
  const avgActualROI = totalROI / count;
  const avgHoldTimeHours = totalHoldMs / count / (1e3 * 60 * 60);
  const winRate = wins / count * 100;
  const dates = completedFlips.map((f) => new Date(f.sellDate).getTime()).sort((a, b) => b - a);
  const lastTradeDate = dates.length > 0 ? new Date(dates[0]).toISOString().split("T")[0] : null;
  const modelGap = avgActualMarginPct - suggestedMarginPct;
  return {
    tradeCount: count,
    avgActualMarginPct: Math.round(avgActualMarginPct * 100) / 100,
    avgActualROI: Math.round(avgActualROI * 100) / 100,
    avgHoldTimeHours: Math.round(avgHoldTimeHours * 10) / 10,
    winRate: Math.round(winRate * 10) / 10,
    lastTradeDate,
    modelGap: Math.round(modelGap * 100) / 100
  };
}

// server/ge-api.ts
var GE_API_BASE = "https://api.weirdgloop.org/exchange/history/rs";
var RS_ITEMDB_BASE = "https://secure.runescape.com/m=itemdb_rs";
var GE_DUMP_URL = "https://chisel.weirdgloop.org/gazproj/gazbot/rs_dump.json";
var USER_AGENT = "RS3FlipTracker/1.0 (Replit App; contact@replit.com)";
var itemCache = [];
var itemPriceCache = /* @__PURE__ */ new Map();
var cacheLastUpdated = 0;
var CACHE_TTL = 30 * 60 * 1e3;
async function refreshItemCache() {
  const now = Date.now();
  if (itemCache.length > 0 && now - cacheLastUpdated < CACHE_TTL) {
    return;
  }
  try {
    console.log("[ge-api] Refreshing item cache from GE dump...");
    const response = await fetch(GE_DUMP_URL, {
      headers: { "User-Agent": USER_AGENT }
    });
    if (!response.ok) {
      console.error("[ge-api] Failed to fetch GE dump:", response.status);
      return;
    }
    const data = await response.json();
    const items = [];
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("%")) continue;
      const itemData = value;
      const id = parseInt(key);
      if (isNaN(id) || !itemData.name) continue;
      items.push({
        id,
        name: itemData.name,
        nameLower: itemData.name.toLowerCase(),
        isMembers: itemData.members,
        geLimit: itemData.limit,
        examine: itemData.examine
      });
      if (itemData.price) {
        itemPriceCache.set(id, {
          price: itemData.price,
          last: itemData.last,
          volume: itemData.volume,
          isMembers: itemData.members,
          geLimit: itemData.limit,
          examine: itemData.examine
        });
      }
    }
    itemCache = items;
    cacheLastUpdated = now;
    console.log(`[ge-api] Cached ${items.length} items`);
  } catch (error) {
    console.error("[ge-api] Failed to refresh item cache:", error);
  }
}
function fuzzyMatch(query, name) {
  const queryLower = query.toLowerCase();
  const nameLower = name.toLowerCase();
  if (nameLower === queryLower) return 100;
  if (nameLower.startsWith(queryLower)) return 90;
  const words = nameLower.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(queryLower)) return 80;
  }
  if (nameLower.includes(queryLower)) return 70;
  return 0;
}
async function searchItems(query) {
  await refreshItemCache();
  if (query.length < 2) return [];
  const queryLower = query.toLowerCase();
  const matches = [];
  for (const item of itemCache) {
    const score = fuzzyMatch(queryLower, item.name);
    if (score > 0) {
      matches.push({ item, score });
    }
  }
  matches.sort((a, b) => b.score - a.score);
  const results = [];
  for (const { item } of matches.slice(0, 15)) {
    const priceData = itemPriceCache.get(item.id);
    if (priceData && priceData.price > 0) {
      results.push({
        id: item.id,
        name: item.name,
        price: priceData.price,
        volume: priceData.volume,
        icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${item.id}`,
        isMembers: item.isMembers,
        geLimit: item.geLimit,
        examine: item.examine
      });
    }
  }
  return results;
}
async function getItemPrice(itemName) {
  try {
    await refreshItemCache();
    const response = await fetch(
      `${GE_API_BASE}/latest?name=${encodeURIComponent(itemName)}`,
      {
        headers: {
          "User-Agent": USER_AGENT
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const keys = Object.keys(data).filter((k) => !k.startsWith("%"));
    if (keys.length === 0) return null;
    const foundName = keys[0];
    const itemData = data[foundName];
    const itemId = parseInt(itemData.id);
    const cachedData = itemPriceCache.get(itemId);
    return {
      id: itemId,
      name: foundName,
      price: itemData.price,
      volume: itemData.volume,
      timestamp: itemData.timestamp,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${itemId}`,
      isMembers: cachedData?.isMembers,
      geLimit: cachedData?.geLimit,
      examine: cachedData?.examine
    };
  } catch (error) {
    console.error("Failed to fetch GE price:", error);
    return null;
  }
}
async function getItemTrend(itemId) {
  try {
    const response = await fetch(
      `${GE_API_BASE}/last90d?id=${itemId}`,
      {
        headers: {
          "User-Agent": USER_AGENT
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const history = data[itemId.toString()];
    if (!history || history.length === 0) return null;
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const prices = sortedHistory.map((h) => h.price);
    const currentPrice = prices[prices.length - 1];
    const last7d = prices.slice(-7);
    const last30d = prices.slice(-30);
    const avgPrice7d = last7d.reduce((a, b) => a + b, 0) / last7d.length;
    const avgPrice30d = last30d.reduce((a, b) => a + b, 0) / last30d.length;
    const lowPrice30d = Math.min(...last30d);
    const highPrice30d = Math.max(...last30d);
    let trendDays = 0;
    let trendDirection = "stable";
    if (prices.length >= 2) {
      const recentPrice = prices[prices.length - 1];
      let lastTrendPrice = recentPrice;
      for (let i = prices.length - 2; i >= 0; i--) {
        const diff = recentPrice - prices[i];
        const percentDiff = Math.abs(diff / prices[i]) * 100;
        if (percentDiff < 2) {
          trendDays++;
          continue;
        }
        if (trendDays === 0) {
          trendDirection = diff > 0 ? "rising" : "falling";
          trendDays = 1;
          lastTrendPrice = prices[i];
        } else {
          const currentTrend = diff > 0 ? "rising" : "falling";
          if (currentTrend === trendDirection) {
            trendDays++;
            lastTrendPrice = prices[i];
          } else {
            break;
          }
        }
      }
    }
    const priceWeekAgo = prices[Math.max(0, prices.length - 8)] || currentPrice;
    const changeAmount = currentPrice - priceWeekAgo;
    const changePercent = changeAmount / priceWeekAgo * 100;
    let recommendation = "hold";
    let recommendationReason = "";
    const priceVsLow = (currentPrice - lowPrice30d) / lowPrice30d * 100;
    const priceVsHigh = (highPrice30d - currentPrice) / highPrice30d * 100;
    const priceVs30dAvg = (currentPrice - avgPrice30d) / avgPrice30d * 100;
    if (priceVsLow < 10 && trendDirection !== "falling") {
      recommendation = "buy";
      recommendationReason = `Near 30-day low (${priceVsLow.toFixed(1)}% above). Good entry point.`;
    } else if (priceVsHigh < 10 && trendDirection !== "rising") {
      recommendation = "sell";
      recommendationReason = `Near 30-day high (${priceVsHigh.toFixed(1)}% below). Consider selling.`;
    } else if (trendDirection === "falling" && trendDays >= 5) {
      recommendation = "hold";
      recommendationReason = `Falling for ${trendDays} days. Wait for stabilization.`;
    } else if (trendDirection === "rising" && trendDays >= 5 && priceVs30dAvg < 5) {
      recommendation = "buy";
      recommendationReason = `Rising trend for ${trendDays} days, still near average.`;
    } else if (priceVs30dAvg < -5) {
      recommendation = "buy";
      recommendationReason = `${Math.abs(priceVs30dAvg).toFixed(1)}% below 30-day average.`;
    } else if (priceVs30dAvg > 10) {
      recommendation = "sell";
      recommendationReason = `${priceVs30dAvg.toFixed(1)}% above 30-day average.`;
    } else {
      recommendation = "hold";
      recommendationReason = "Price is within normal range. Monitor for opportunities.";
    }
    return {
      direction: trendDirection,
      changePercent: Math.round(changePercent * 100) / 100,
      changeAmount: Math.round(changeAmount),
      trendDays: Math.max(1, trendDays),
      avgPrice7d: Math.round(avgPrice7d),
      avgPrice30d: Math.round(avgPrice30d),
      lowPrice30d: Math.round(lowPrice30d),
      highPrice30d: Math.round(highPrice30d),
      recommendation,
      recommendationReason
    };
  } catch (error) {
    console.error("Failed to fetch item trend:", error);
    return null;
  }
}
function parseTimestamp(h) {
  if (typeof h.timestamp === "number") {
    const ts = h.timestamp > 9999999999 ? h.timestamp : h.timestamp * 1e3;
    return new Date(ts).toISOString().split("T")[0];
  } else if (typeof h.timestamp === "string") {
    if (h.timestamp.includes("T")) {
      return h.timestamp.split("T")[0];
    }
    return new Date(h.timestamp).toISOString().split("T")[0];
  }
  return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
}
async function getItemPriceHistory(itemId, period = "daily") {
  try {
    const useAllHistory = period === "weekly" || period === "monthly" || period === "yearly";
    const endpoint = useAllHistory ? "all" : "last90d";
    const response = await fetch(
      `${GE_API_BASE}/${endpoint}?id=${itemId}`,
      {
        headers: {
          "User-Agent": USER_AGENT
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const history = data[itemId.toString()];
    if (!history || history.length === 0) return null;
    const sortedHistory = [...history].sort(
      (a, b) => {
        const tsA = typeof a.timestamp === "number" ? a.timestamp > 9999999999 ? a.timestamp : a.timestamp * 1e3 : new Date(a.timestamp).getTime();
        const tsB = typeof b.timestamp === "number" ? b.timestamp > 9999999999 ? b.timestamp : b.timestamp * 1e3 : new Date(b.timestamp).getTime();
        return tsA - tsB;
      }
    );
    const allPoints = sortedHistory.map((h) => ({
      date: parseTimestamp(h),
      price: h.price,
      volume: h.volume
    }));
    const now = /* @__PURE__ */ new Date();
    let cutoffDate;
    switch (period) {
      case "daily":
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1e3);
        break;
      case "weekly":
        cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1e3);
        break;
      case "monthly":
        cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1e3);
        break;
      case "yearly":
        cutoffDate = /* @__PURE__ */ new Date(0);
        break;
    }
    const filteredPoints = allPoints.filter((p) => new Date(p.date) >= cutoffDate);
    if (period === "weekly") {
      return aggregateToWeekly(filteredPoints);
    } else if (period === "monthly") {
      return aggregateToMonthly(filteredPoints);
    } else if (period === "yearly") {
      return aggregateToMonthly(filteredPoints);
    }
    return filteredPoints;
  } catch (error) {
    console.error("Failed to fetch item price history:", error);
    return null;
  }
}
function aggregateToWeekly(points) {
  const weeks = /* @__PURE__ */ new Map();
  for (const p of points) {
    const d = new Date(p.date);
    const day = d.getDay();
    const weekStart = new Date(d.getTime() - day * 24 * 60 * 60 * 1e3);
    const key = weekStart.toISOString().split("T")[0];
    if (!weeks.has(key)) weeks.set(key, { prices: [], volumes: [] });
    const w = weeks.get(key);
    w.prices.push(p.price);
    if (p.volume) w.volumes.push(p.volume);
  }
  return Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => ({
    date,
    price: Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length),
    volume: data.volumes.length > 0 ? Math.round(data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length) : void 0
  }));
}
function aggregateToMonthly(points) {
  const months = /* @__PURE__ */ new Map();
  for (const p of points) {
    const key = p.date.substring(0, 7) + "-01";
    if (!months.has(key)) months.set(key, { prices: [], volumes: [] });
    const m = months.get(key);
    m.prices.push(p.price);
    if (p.volume) m.volumes.push(p.volume);
  }
  return Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => ({
    date,
    price: Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length),
    volume: data.volumes.length > 0 ? Math.round(data.volumes.reduce((a, b) => a + b, 0) / data.volumes.length) : void 0
  }));
}
async function getItemPriceHistoryFull(itemId) {
  try {
    const response = await fetch(
      `${GE_API_BASE}/all?id=${itemId}`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const history = data[itemId.toString()];
    if (!history || history.length === 0) return null;
    const sortedHistory = [...history].sort(
      (a, b) => {
        const tsA = typeof a.timestamp === "number" ? a.timestamp > 9999999999 ? a.timestamp : a.timestamp * 1e3 : new Date(a.timestamp).getTime();
        const tsB = typeof b.timestamp === "number" ? b.timestamp > 9999999999 ? b.timestamp : b.timestamp * 1e3 : new Date(b.timestamp).getTime();
        return tsA - tsB;
      }
    );
    const allPoints = sortedHistory.map((h) => ({
      date: parseTimestamp(h),
      price: h.price,
      volume: h.volume
    }));
    const monthly = aggregateToMonthly(allPoints);
    const now = /* @__PURE__ */ new Date();
    const cutoff90d = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1e3);
    const daily = allPoints.filter((p) => new Date(p.date) >= cutoff90d);
    return { monthly, daily };
  } catch (error) {
    console.error("Failed to fetch full item price history:", error);
    return null;
  }
}
async function getItemSuggestions(itemId) {
  try {
    const response = await fetch(
      `${GE_API_BASE}/last90d?id=${itemId}`,
      {
        headers: {
          "User-Agent": USER_AGENT
        }
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const history = data[itemId.toString()];
    if (!history || history.length === 0) return null;
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const prices = sortedHistory.map((h) => h.price);
    const currentPrice = prices[prices.length - 1];
    const last7d = prices.slice(-7);
    const last30d = prices.slice(-30);
    const last14d = prices.slice(-14);
    const avgPrice7d = last7d.reduce((a, b) => a + b, 0) / last7d.length;
    const avgPrice30d = last30d.reduce((a, b) => a + b, 0) / last30d.length;
    const avgPrice14d = last14d.reduce((a, b) => a + b, 0) / last14d.length;
    const lowPrice30d = Math.min(...last30d);
    const highPrice30d = Math.max(...last30d);
    const mean30d = avgPrice30d;
    const squaredDiffs = last30d.map((p) => Math.pow(p - mean30d, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(avgSquaredDiff);
    const volatility = stdDev / mean30d * 100;
    let trend = "stable";
    const priceChange7d = (currentPrice - avgPrice7d) / avgPrice7d * 100;
    if (priceChange7d > 3) trend = "rising";
    else if (priceChange7d < -3) trend = "falling";
    let buyDiscount = 0.05;
    if (volatility > 10) buyDiscount = 0.08;
    if (volatility > 20) buyDiscount = 0.12;
    if (trend === "falling") buyDiscount += 0.03;
    const targetBuyFromLow = lowPrice30d + (avgPrice30d - lowPrice30d) * 0.3;
    const targetBuyFromCurrent = currentPrice * (1 - buyDiscount);
    const suggestedBuyPrice = Math.round(Math.max(
      lowPrice30d * 1.02,
      // At least 2% above 30-day low (realistic)
      Math.min(targetBuyFromLow, targetBuyFromCurrent)
    ));
    let sellPremium = 0.05;
    if (volatility > 10) sellPremium = 0.08;
    if (volatility > 20) sellPremium = 0.12;
    if (trend === "rising") sellPremium += 0.02;
    const targetSellFromHigh = highPrice30d - (highPrice30d - avgPrice30d) * 0.3;
    const targetSellFromCurrent = currentPrice * (1 + sellPremium);
    const suggestedSellPrice = Math.round(Math.min(
      highPrice30d * 0.98,
      // At most 2% below 30-day high (realistic)
      Math.max(targetSellFromHigh, targetSellFromCurrent)
    ));
    const potentialProfit = suggestedSellPrice - suggestedBuyPrice;
    const potentialROI = (suggestedSellPrice - suggestedBuyPrice) / suggestedBuyPrice * 100;
    let confidence = "medium";
    let confidenceReason = "";
    if (volatility >= 5 && volatility <= 15 && potentialROI >= 8) {
      confidence = "high";
      confidenceReason = "Good price range with moderate volatility. Historical patterns suggest reliable flip opportunities.";
    } else if (volatility > 20) {
      confidence = "low";
      confidenceReason = "High price volatility. Prices may swing unexpectedly. Consider smaller positions.";
    } else if (potentialROI < 5) {
      confidence = "low";
      confidenceReason = "Narrow profit margin. Transaction costs and price movements may reduce actual profit.";
    } else if (trend === "falling" && currentPrice > avgPrice30d) {
      confidence = "medium";
      confidenceReason = "Price declining but still above average. Wait for better entry point or use suggested buy price.";
    } else if (trend === "rising" && currentPrice < avgPrice30d) {
      confidence = "high";
      confidenceReason = "Price rising from below average. Good momentum for flipping.";
    } else {
      confidenceReason = "Standard market conditions. Suggested prices based on 30-day trading range.";
    }
    const buyReason = suggestedBuyPrice < avgPrice7d ? `${((avgPrice7d - suggestedBuyPrice) / avgPrice7d * 100).toFixed(1)}% below 7-day avg (${formatPriceSimple(avgPrice7d)} gp)` : `Near recent low of ${formatPriceSimple(lowPrice30d)} gp`;
    const sellReason = suggestedSellPrice > avgPrice7d ? `${((suggestedSellPrice - avgPrice7d) / avgPrice7d * 100).toFixed(1)}% above 7-day avg, targeting ${formatPriceSimple(highPrice30d)} gp high` : `Based on ${formatPriceSimple(highPrice30d)} gp 30-day high`;
    return {
      suggestedBuyPrice,
      suggestedSellPrice,
      potentialProfit,
      potentialROI: Math.round(potentialROI * 100) / 100,
      confidence,
      confidenceReason,
      buyReason,
      sellReason,
      currentPrice,
      avgPrice7d: Math.round(avgPrice7d),
      avgPrice30d: Math.round(avgPrice30d),
      lowPrice30d,
      highPrice30d,
      volatility: Math.round(volatility * 100) / 100,
      trend
    };
  } catch (error) {
    console.error("Failed to calculate item suggestions:", error);
    return null;
  }
}
function formatPriceSimple(price) {
  if (price >= 1e9) return `${(price / 1e9).toFixed(1)}B`;
  if (price >= 1e6) return `${(price / 1e6).toFixed(1)}M`;
  if (price >= 1e3) return `${(price / 1e3).toFixed(1)}K`;
  return price.toLocaleString();
}
async function getAllItemsForScanner() {
  await refreshItemCache();
  const results = [];
  for (const item of itemCache) {
    const priceData = itemPriceCache.get(item.id);
    if (!priceData || priceData.price <= 0) continue;
    const price = priceData.price;
    const lastPrice = priceData.last ?? price;
    const geLimit = item.geLimit ?? 0;
    const volume = priceData.volume ?? 0;
    const margin = Math.round(price * 0.01);
    const buyPrice = price;
    const sellPrice = price + margin;
    const potentialProfit = margin * geLimit;
    const marginVolume = margin * volume;
    const taxPerItem = sellPrice <= 49 ? 0 : Math.floor(sellPrice * 0.02);
    const totalTax = taxPerItem * geLimit;
    const grossProfit = margin * geLimit;
    const netProfit = grossProfit - totalTax;
    const totalInvestment = buyPrice * geLimit;
    const roi = totalInvestment > 0 ? netProfit / totalInvestment * 100 : 0;
    const capitalEfficiency = totalInvestment > 0 ? netProfit / totalInvestment * 1e4 : 0;
    const volumeScore = volume > 0 ? Math.min(volume / 1e4, 1) : 0;
    const marginScore = margin > 0 ? Math.min(margin / price, 0.1) * 10 : 0;
    const rsi = Math.round(30 + volumeScore * 30 + marginScore * 40);
    const trend = margin > price * 0.015 ? "up" : margin < price * 5e-3 ? "down" : "stable";
    const marginPercent = margin / price;
    const volatility = marginPercent > 0.03 ? "high" : marginPercent > 0.01 ? "medium" : "low";
    const smartPricing = calculateSmartPricing(price, null, null);
    results.push({
      id: item.id,
      name: item.name,
      icon: `${RS_ITEMDB_BASE}/obj_sprite.gif?id=${item.id}`,
      isMembers: item.isMembers ?? false,
      geLimit,
      buyPrice,
      sellPrice,
      margin,
      volume,
      potentialProfit,
      marginVolume,
      roi: Math.round(roi * 100) / 100,
      netProfit,
      capitalEfficiency: Math.round(capitalEfficiency),
      rsi: Math.min(100, Math.max(0, rsi)),
      trend,
      volatility,
      suggestedBuyPrice: smartPricing.suggestedBuyPrice,
      suggestedSellPrice: smartPricing.suggestedSellPrice,
      suggestedMarginPct: smartPricing.suggestedMarginPct,
      priceTier: smartPricing.priceTier,
      confidence: smartPricing.confidence,
      range7dLow: null,
      range7dHigh: null,
      range7dSpreadPct: null
    });
  }
  for (const r of results) {
    const cached = range7dCache.get(r.id);
    if (cached) {
      r.range7dLow = cached.low;
      r.range7dHigh = cached.high;
      r.range7dSpreadPct = cached.spreadPct;
    } else {
      const pd = itemPriceCache.get(r.id);
      if (pd && pd.price > 0) {
        const current = pd.price;
        const last = pd.last ?? current;
        const dailyDelta = Math.abs(current - last);
        const swing7d = dailyDelta * Math.sqrt(7);
        const minSwing = Math.max(1, Math.round(current * 1e-3));
        const effectiveSwing = Math.max(swing7d, minSwing);
        r.range7dLow = Math.round(Math.min(current, last) - effectiveSwing);
        r.range7dHigh = Math.round(Math.max(current, last) + effectiveSwing);
        if (r.range7dLow <= 0) r.range7dLow = 1;
        r.range7dSpreadPct = r.range7dLow > 0 ? Math.round((r.range7dHigh - r.range7dLow) / r.range7dLow * 1e4) / 100 : 0;
      }
    }
  }
  return results;
}
var range7dCache = /* @__PURE__ */ new Map();
var RANGE_REFRESH_INTERVAL = 15 * 60 * 1e3;

// server/replitAuth.ts
import * as client from "openid-client";
import { Strategy } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { z as z2 } from "zod";
var getOidcConfig = memoize(
  async () => {
    if (!process.env.REPL_ID) {
      throw new Error("REPL_ID is required for Replit OIDC");
    }
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID
    );
  },
  { maxAge: 3600 * 1e3 }
);
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions"
  });
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: sessionTtl
    }
  });
}
function updateUserSession(user, tokens) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
  user.authProvider = "replit";
}
async function upsertReplitUser(claims) {
  const user = await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"]
  });
  return { id: user.id };
}
var registerSchema = z2.object({
  email: z2.string().email(),
  password: z2.string().min(6),
  firstName: z2.string().min(1).optional(),
  lastName: z2.string().min(1).optional()
});
var loginSchema = z2.object({
  email: z2.string().email(),
  password: z2.string().min(1)
});
function getOAuthRedirectUri(req, path) {
  const forwardedProto = req.get("x-forwarded-proto");
  const protocol = forwardedProto?.split(",")[0] ?? req.protocol;
  return `${protocol}://${req.hostname}${path}`;
}
async function setupAuth(app) {
  const replitAuthEnabled = !!process.env.REPL_ID;
  const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      replit: replitAuthEnabled,
      email: true,
      discord: !!(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET),
      google: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
    });
  });
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());
  const config = replitAuthEnabled ? await getOidcConfig() : null;
  const verify = async (tokens, verified) => {
    const user = {};
    updateUserSession(user, tokens);
    const dbUser = await upsertReplitUser(tokens.claims());
    user.claims.sub = dbUser.id;
    verified(null, user);
  };
  const registeredStrategies = /* @__PURE__ */ new Set();
  const ensureStrategy = (domain) => {
    if (!config) {
      throw new Error("Replit OIDC is not configured");
    }
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };
  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user));
  if (config) {
    app.get("/api/login", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        prompt: "login consent",
        scope: ["openid", "email", "profile", "offline_access"]
      })(req, res, next);
    });
    app.get("/api/callback", (req, res, next) => {
      ensureStrategy(req.hostname);
      passport.authenticate(`replitauth:${req.hostname}`, {
        successReturnToOrRedirect: "/",
        failureRedirect: "/api/login"
      })(req, res, next);
    });
  }
  app.get("/api/logout", (req, res) => {
    const user = req.user;
    const isReplitUser = config && user?.authProvider === "replit" && user?.claims;
    req.logout(() => {
      if (isReplitUser) {
        try {
          res.redirect(
            client.buildEndSessionUrl(config, {
              client_id: process.env.REPL_ID,
              post_logout_redirect_uri: `${req.protocol}://${req.hostname}`
            }).href
          );
        } catch {
          res.redirect("/");
        }
      } else {
        res.redirect("/");
      }
    });
  });
  app.post("/api/logout", (req, res) => {
    req.logout(() => {
      res.json({ success: true });
    });
  });
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { email, password, firstName, lastName } = parsed.data;
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "An account with this email already exists. Try signing in instead." });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await storage.upsertUser({
        email,
        firstName: firstName || null,
        lastName: lastName || null,
        password: hashedPassword,
        authProvider: "email"
      });
      const sessionUser = {
        claims: { sub: user.id },
        authProvider: "email",
        expires_at: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
      };
      req.login(sessionUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Registration succeeded but login failed" });
        }
        res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });
  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      const sessionUser = {
        claims: { sub: user.id },
        authProvider: "email",
        expires_at: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
      };
      req.login(sessionUser, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) {
    app.get("/api/auth/discord", (req, res) => {
      const redirectUri = `https://${req.hostname}/api/auth/discord/callback`;
      const params = new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify email"
      });
      res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
    });
    app.get("/api/auth/discord/callback", async (req, res) => {
      try {
        const { code } = req.query;
        if (!code || typeof code !== "string") {
          return res.redirect("/?error=discord_auth_failed");
        }
        const redirectUri = `https://${req.hostname}/api/auth/discord/callback`;
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri
          })
        });
        if (!tokenResponse.ok) {
          console.error("Discord token exchange failed:", await tokenResponse.text());
          return res.redirect("/?error=discord_auth_failed");
        }
        const tokens = await tokenResponse.json();
        const userResponse = await fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        if (!userResponse.ok) {
          return res.redirect("/?error=discord_auth_failed");
        }
        const discordUser = await userResponse.json();
        let user = await storage.getUserByDiscordId(discordUser.id);
        if (!user) {
          if (discordUser.email) {
            const existingByEmail = await storage.getUserByEmail(discordUser.email);
            if (existingByEmail) {
              await storage.linkDiscordId(existingByEmail.id, discordUser.id);
              user = existingByEmail;
            }
          }
        }
        if (!user) {
          user = await storage.upsertUser({
            email: discordUser.email || null,
            firstName: discordUser.global_name || discordUser.username,
            lastName: null,
            profileImageUrl: discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null,
            discordId: discordUser.id,
            authProvider: "discord"
          });
        }
        const sessionUser = {
          claims: { sub: user.id },
          authProvider: "discord",
          expires_at: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
        };
        req.login(sessionUser, (err) => {
          if (err) {
            console.error("Discord login session error:", err);
            return res.redirect("/?error=discord_auth_failed");
          }
          res.redirect("/");
        });
      } catch (error) {
        console.error("Discord auth error:", error);
        res.redirect("/?error=discord_auth_failed");
      }
    });
  }
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    app.get("/api/auth/google", (req, res) => {
      const redirectUri = getOAuthRedirectUri(req, "/api/auth/google/callback");
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "online"
      });
      res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    });
    app.get("/api/auth/google/callback", async (req, res) => {
      try {
        const { code } = req.query;
        if (!code || typeof code !== "string") {
          return res.redirect("/?error=google_auth_failed");
        }
        const redirectUri = getOAuthRedirectUri(req, "/api/auth/google/callback");
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri
          })
        });
        if (!tokenResponse.ok) {
          console.error("Google token exchange failed:", await tokenResponse.text());
          return res.redirect("/?error=google_auth_failed");
        }
        const tokens = await tokenResponse.json();
        if (!tokens.access_token) {
          return res.redirect("/?error=google_auth_failed");
        }
        const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });
        if (!userResponse.ok) {
          console.error("Google userinfo failed:", await userResponse.text());
          return res.redirect("/?error=google_auth_failed");
        }
        const googleUser = await userResponse.json();
        if (!googleUser.email || googleUser.email_verified === false) {
          return res.redirect("/?error=google_email_unverified");
        }
        let user = await storage.getUserByEmail(googleUser.email);
        if (user) {
          user = await storage.updateUserProfile(user.id, {
            firstName: googleUser.given_name || googleUser.name || user.firstName || void 0,
            lastName: googleUser.family_name || user.lastName || void 0,
            profileImageUrl: googleUser.picture || user.profileImageUrl || void 0
          }) ?? user;
        } else {
          user = await storage.upsertUser({
            email: googleUser.email,
            firstName: googleUser.given_name || googleUser.name || null,
            lastName: googleUser.family_name || null,
            profileImageUrl: googleUser.picture || null,
            authProvider: "google"
          });
        }
        const sessionUser = {
          claims: { sub: user.id },
          authProvider: "google",
          expires_at: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
        };
        req.login(sessionUser, (err) => {
          if (err) {
            console.error("Google login session error:", err);
            return res.redirect("/?error=google_auth_failed");
          }
          res.redirect("/");
        });
      } catch (error) {
        console.error("Google auth error:", error);
        res.redirect("/?error=google_auth_failed");
      }
    });
  }
}
var isAuthenticated = async (req, res, next) => {
  const user = req.user;
  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const now = Math.floor(Date.now() / 1e3);
  if (user.authProvider === "email" || user.authProvider === "discord" || user.authProvider === "google") {
    if (now <= user.expires_at) {
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (now <= user.expires_at) {
    return next();
  }
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// server/ocr.ts
import Tesseract from "tesseract.js";
async function processScreenshot(imageBuffer) {
  try {
    const result = await Tesseract.recognize(imageBuffer, "eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    const rawText = result.data.text;
    const overallConfidence = result.data.confidence;
    const items = parseRS3Items(rawText);
    return {
      items,
      rawText,
      overallConfidence
    };
  } catch (error) {
    console.error("[OCR] Failed to process screenshot:", error);
    throw new Error("Failed to process screenshot");
  }
}
function parseRS3Items(text2) {
  const items = [];
  const lines = text2.split("\n").filter((line) => line.trim());
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 3) continue;
    const quantityMatch = trimmed.match(/^(\d+[KkMm]?)\s*x?\s*(.+)$/);
    const reverseMatch = trimmed.match(/^(.+?)\s*x?\s*(\d+[KkMm]?)$/);
    let name = "";
    let quantity = 1;
    let confidence = 0.5;
    if (quantityMatch) {
      quantity = parseQuantity(quantityMatch[1]);
      name = quantityMatch[2].trim();
      confidence = 0.7;
    } else if (reverseMatch && reverseMatch[2]) {
      name = reverseMatch[1].trim();
      quantity = parseQuantity(reverseMatch[2]);
      confidence = 0.6;
    } else {
      name = trimmed;
      confidence = 0.4;
    }
    name = cleanItemName(name);
    if (name.length >= 3 && !isNoise(name)) {
      items.push({ name, quantity, confidence });
    }
  }
  return items;
}
function parseQuantity(str) {
  const cleaned = str.toUpperCase().replace(/,/g, "");
  if (cleaned.endsWith("K")) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1e3);
  }
  if (cleaned.endsWith("M")) {
    return Math.round(parseFloat(cleaned.slice(0, -1)) * 1e6);
  }
  return parseInt(cleaned, 10) || 1;
}
function cleanItemName(name) {
  return name.replace(/[^a-zA-Z0-9\s\-'()]/g, "").replace(/\s+/g, " ").trim();
}
function isNoise(text2) {
  const noisePatterns = [
    /^bank$/i,
    /^inventory$/i,
    /^equipment$/i,
    /^worn$/i,
    /^price$/i,
    /^value$/i,
    /^total$/i,
    /^coins?$/i,
    /^gp$/i,
    /^\d+$/,
    /^x\d+$/i,
    /^tab\s*\d+$/i
  ];
  return noisePatterns.some((pattern) => pattern.test(text2.trim()));
}
async function matchItemsToGE(items, searchFn) {
  const results = [];
  for (const item of items) {
    try {
      const searchResults = await searchFn(item.name);
      if (searchResults.length > 0) {
        const bestMatch = searchResults[0];
        const nameMatch = calculateNameSimilarity(item.name.toLowerCase(), bestMatch.name.toLowerCase());
        results.push({
          original: item,
          match: bestMatch,
          matchConfidence: nameMatch * item.confidence
        });
      } else {
        results.push({
          original: item,
          match: null,
          matchConfidence: 0
        });
      }
    } catch (error) {
      results.push({
        original: item,
        match: null,
        matchConfidence: 0
      });
    }
  }
  return results;
}
function calculateNameSimilarity(a, b) {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const commonWords = aWords.filter((word) => bWords.includes(word));
  const similarity = commonWords.length * 2 / (aWords.length + bWords.length);
  return Math.max(0.3, similarity);
}

// server/ai-vision.ts
import OpenAI from "openai";
var openai;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  openai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}
async function analyzeRS3Screenshot(imageBuffer) {
  try {
    const openai3 = getOpenAI();
    const base64Image = imageBuffer.toString("base64");
    const mimeType = detectImageMimeType(imageBuffer);
    const systemPrompt = `You are an expert at identifying items from RuneScape 3 (RS3) bank screenshots. 
Your task is to analyze the screenshot and identify all visible items with their quantities.

RS3 Bank Screenshot Characteristics:
- Items appear in a grid of slots
- Each slot shows an item icon with a quantity overlay (usually in the corner)
- Quantities may be abbreviated: K = thousands (1K = 1,000), M = millions (1M = 1,000,000), B = billions
- Some items stack, showing large numbers; others don't stack and show quantity as separate slots
- Item names should match official RS3 item names as closely as possible

Output Requirements:
- Identify each unique item and its total quantity
- Use official RS3 item names (e.g., "Rune platebody", "Dragon bones", "Grimy ranarr")
- Convert abbreviated quantities to full numbers (e.g., "12.5K" \u2192 12500)
- Include a confidence score (0-1) for each identification
- Add notes for uncertain identifications

Respond with valid JSON only, in this exact format:
{
  "items": [
    {"name": "Item Name", "quantity": 1000, "confidence": 0.95, "notes": "optional notes"},
    ...
  ]
}`;
    const response = await openai3.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this RS3 bank screenshot and identify all items with their quantities. Return the results as JSON."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096
    });
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        items: [],
        rawResponse: "",
        success: false,
        error: "No response from AI"
      };
    }
    const parsed = JSON.parse(content);
    const items = (parsed.items || []).map((item) => ({
      name: String(item.name || "").trim(),
      quantity: parseQuantity2(item.quantity),
      confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0.5)),
      notes: item.notes
    })).filter((item) => item.name.length > 0);
    return {
      items,
      rawResponse: content,
      success: true
    };
  } catch (error) {
    console.error("[AI Vision] Error analyzing screenshot:", error);
    return {
      items: [],
      rawResponse: "",
      success: false,
      error: error.message || "Failed to analyze screenshot"
    };
  }
}
function parseQuantity2(value) {
  if (typeof value === "number") return Math.round(value);
  const str = String(value).toUpperCase().replace(/,/g, "").trim();
  if (str.endsWith("B")) {
    return Math.round(parseFloat(str.slice(0, -1)) * 1e9);
  }
  if (str.endsWith("M")) {
    return Math.round(parseFloat(str.slice(0, -1)) * 1e6);
  }
  if (str.endsWith("K")) {
    return Math.round(parseFloat(str.slice(0, -1)) * 1e3);
  }
  return parseInt(str, 10) || 1;
}
function detectImageMimeType(buffer) {
  if (buffer[0] === 255 && buffer[1] === 216) return "image/jpeg";
  if (buffer[0] === 137 && buffer[1] === 80) return "image/png";
  if (buffer[0] === 71 && buffer[1] === 73) return "image/gif";
  if (buffer[0] === 82 && buffer[1] === 73) return "image/webp";
  return "image/png";
}

// server/ai-recommendations.ts
import OpenAI2 from "openai";
var openai2;
function getOpenAI2() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  openai2 ??= new OpenAI2({ apiKey: process.env.OPENAI_API_KEY });
  return openai2;
}
function analyzeUserTradingProfile(flips2) {
  const completedFlips = flips2.filter((f) => f.sellPrice && f.sellDate && !f.deletedAt);
  const strategyStats = /* @__PURE__ */ new Map();
  const itemCounts = /* @__PURE__ */ new Map();
  const itemProfits = /* @__PURE__ */ new Map();
  let totalProfit = 0;
  let totalROI = 0;
  let wins = 0;
  let totalHoldTime = 0;
  let minPrice = Infinity;
  let maxPrice = 0;
  let membersCount = 0;
  let f2pCount = 0;
  const now = Date.now();
  let dailyVolume = 0;
  let weeklyVolume = 0;
  let monthlyVolume = 0;
  for (const flip of completedFlips) {
    const sellPrice = flip.sellPrice;
    const sellValue = sellPrice * flip.quantity;
    const buyValue = flip.buyPrice * flip.quantity;
    const taxPaid = Math.floor(sellPrice * 0.02) * flip.quantity;
    const profit = sellValue - buyValue - taxPaid;
    const roi = (sellValue - buyValue - taxPaid) / buyValue * 100;
    totalProfit += profit;
    totalROI += roi;
    if (profit > 0) wins++;
    const holdTime = new Date(flip.sellDate).getTime() - new Date(flip.buyDate).getTime();
    totalHoldTime += holdTime;
    minPrice = Math.min(minPrice, flip.buyPrice);
    maxPrice = Math.max(maxPrice, flip.buyPrice, sellPrice);
    if (flip.isMembers) membersCount++;
    else f2pCount++;
    const strategy = flip.strategyTag || "Other";
    const stats = strategyStats.get(strategy) || { count: 0, totalROI: 0, wins: 0 };
    stats.count++;
    stats.totalROI += roi;
    if (profit > 0) stats.wins++;
    strategyStats.set(strategy, stats);
    const itemName = flip.itemName;
    itemCounts.set(itemName, (itemCounts.get(itemName) || 0) + 1);
    const existing = itemProfits.get(itemName) || { profit: 0, totalRoi: 0, count: 0 };
    existing.profit += profit;
    existing.totalRoi += roi;
    existing.count += 1;
    itemProfits.set(itemName, existing);
    const buyDate = new Date(flip.buyDate).getTime();
    if (now - buyDate < 864e5) dailyVolume += buyValue;
    if (now - buyDate < 6048e5) weeklyVolume += buyValue;
    if (now - buyDate < 2592e6) monthlyVolume += buyValue;
  }
  const preferredStrategies = Array.from(strategyStats.entries()).map(([strategy, stats]) => ({
    strategy,
    frequency: stats.count,
    avgROI: stats.count > 0 ? stats.totalROI / stats.count : 0,
    winRate: stats.count > 0 ? stats.wins / stats.count * 100 : 0
  })).sort((a, b) => b.frequency - a.frequency);
  const avgROI = completedFlips.length > 0 ? totalROI / completedFlips.length : 0;
  const winRate = completedFlips.length > 0 ? wins / completedFlips.length * 100 : 0;
  const avgHoldTime = completedFlips.length > 0 ? totalHoldTime / completedFlips.length : 0;
  let riskProfile = "moderate";
  const avgFlipValue = completedFlips.length > 0 ? completedFlips.reduce((sum, f) => sum + f.buyPrice * f.quantity, 0) / completedFlips.length : 0;
  const hasFastFlips = preferredStrategies.some((s) => s.strategy === "Fast Flip" && s.frequency > 2);
  const hasSpeculative = preferredStrategies.some((s) => s.strategy === "Speculative" && s.frequency > 1);
  if (hasSpeculative || avgROI > 15) {
    riskProfile = "aggressive";
  } else if (hasFastFlips || avgROI < 5) {
    riskProfile = "conservative";
  }
  let membershipPreference = "both";
  if (membersCount > f2pCount * 2) membershipPreference = "members";
  else if (f2pCount > membersCount * 2) membershipPreference = "f2p";
  const topPerformingItems = Array.from(itemProfits.entries()).map(([name, data]) => ({ name, profit: data.profit, roiPercent: data.count > 0 ? data.totalRoi / data.count : 0 })).sort((a, b) => b.profit - a.profit).slice(0, 5);
  const frequentlyTradedItems = Array.from(itemCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name]) => name);
  return {
    preferredStrategies,
    preferredPriceRange: {
      min: minPrice === Infinity ? 0 : minPrice,
      max: maxPrice === 0 ? 1e7 : maxPrice
    },
    avgHoldTime,
    riskProfile,
    membershipPreference,
    totalFlips: completedFlips.length,
    winRate,
    avgROI,
    topPerformingItems,
    frequentlyTradedItems,
    tradingVolume: { daily: dailyVolume, weekly: weeklyVolume, monthly: monthlyVolume }
  };
}
function calculateItemStats(flips2) {
  const completedFlips = flips2.filter((f) => f.sellPrice && f.sellDate && !f.deletedAt);
  const itemMap = /* @__PURE__ */ new Map();
  for (const flip of completedFlips) {
    const sellPrice = flip.sellPrice;
    const taxPaid = Math.floor(sellPrice * 0.02) * flip.quantity;
    const profit = sellPrice * flip.quantity - flip.buyPrice * flip.quantity - taxPaid;
    const roi = (sellPrice - flip.buyPrice - Math.floor(sellPrice * 0.02)) / flip.buyPrice * 100;
    const holdTime = new Date(flip.sellDate).getTime() - new Date(flip.buyDate).getTime();
    const existing = itemMap.get(flip.itemName) || {
      trades: [],
      totalProfit: 0,
      totalBuyPrice: 0,
      totalSellPrice: 0,
      totalROI: 0,
      wins: 0,
      totalHoldTime: 0,
      strategies: /* @__PURE__ */ new Set()
    };
    existing.trades.push(flip);
    existing.totalProfit += profit;
    existing.totalBuyPrice += flip.buyPrice;
    existing.totalSellPrice += sellPrice;
    existing.totalROI += roi;
    if (profit > 0) existing.wins++;
    existing.totalHoldTime += holdTime;
    if (flip.strategyTag) existing.strategies.add(flip.strategyTag);
    itemMap.set(flip.itemName, existing);
  }
  return Array.from(itemMap.entries()).map(([itemName, data]) => {
    const count = data.trades.length;
    const latestFlip = data.trades.sort(
      (a, b) => new Date(b.sellDate).getTime() - new Date(a.sellDate).getTime()
    )[0];
    return {
      itemName,
      itemId: latestFlip?.itemId || null,
      itemIcon: latestFlip?.itemIcon || null,
      tradeCount: count,
      totalProfit: data.totalProfit,
      avgBuyPrice: Math.round(data.totalBuyPrice / count),
      avgSellPrice: Math.round(data.totalSellPrice / count),
      avgROI: data.totalROI / count,
      winRate: data.wins / count * 100,
      avgHoldTimeMs: data.totalHoldTime / count,
      lastTraded: new Date(latestFlip?.sellDate),
      strategies: Array.from(data.strategies),
      isMembers: latestFlip?.isMembers ?? null
    };
  });
}
async function getPersonalizedRecommendations(profile, existingFlips) {
  const openPositions = existingFlips.filter((f) => !f.sellPrice && !f.deletedAt).map((f) => f.itemName.toLowerCase());
  const itemStats = calculateItemStats(existingFlips);
  const availableItems = itemStats.filter(
    (item) => !openPositions.includes(item.itemName.toLowerCase())
  );
  console.log("[AI Recommendations] Found", availableItems.length, "unique items in trading history");
  if (availableItems.length === 0) {
    console.log("[AI Recommendations] No items in history, returning empty");
    return [];
  }
  if (availableItems.length <= 5) {
    console.log("[AI Recommendations] Few items, returning sorted by profit");
    return availableItems.sort((a, b) => b.totalProfit - a.totalProfit).map((item) => buildRecommendation(item, profile, "Top performer from your history"));
  }
  const itemSummaries = availableItems.sort((a, b) => b.tradeCount - a.tradeCount).slice(0, 30).map((item) => ({
    name: item.itemName,
    trades: item.tradeCount,
    profit: formatGp(item.totalProfit),
    avgBuy: formatGp(item.avgBuyPrice),
    avgSell: formatGp(item.avgSellPrice),
    roi: `${item.avgROI.toFixed(1)}%`,
    winRate: `${item.winRate.toFixed(0)}%`,
    holdTime: formatHoldTime(item.avgHoldTimeMs),
    strategies: item.strategies.join(", ") || "Unknown",
    members: item.isMembers ? "Members" : "F2P"
  }));
  const prompt = `You are an RS3 trading advisor. Analyze this user's trading history and select the 5 BEST items they should trade again.

USER PROFILE:
- Risk Profile: ${profile.riskProfile}
- Average ROI: ${profile.avgROI.toFixed(1)}%
- Win Rate: ${profile.winRate.toFixed(1)}%
- Preferred Strategies: ${profile.preferredStrategies.map((s) => s.strategy).slice(0, 3).join(", ") || "Various"}

ITEMS FROM USER'S TRADING HISTORY (select from these ONLY):
${JSON.stringify(itemSummaries, null, 2)}

SELECTION CRITERIA:
1. Prioritize items with high profit AND high win rate
2. Consider items matching their preferred strategies
3. Factor in ROI and trading frequency
4. Balance between proven winners and items with improvement potential

Respond with JSON containing an "items" array. Each item must use the EXACT item name from the list above:
{
  "items": [
    {
      "itemName": "EXACT name from list",
      "reasoning": "Why this item suits them",
      "suggestedStrategy": "Fast Flip|Slow Flip|Bulk|High Margin|Speculative",
      "confidence": "high|medium|low",
      "matchScore": 0-100,
      "tips": "Specific trading tip for this item"
    }
  ]
}`;
  try {
    console.log("[AI Recommendations] Asking AI to analyze", itemSummaries.length, "items");
    const openai3 = getOpenAI2();
    const response = await openai3.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an RS3 GE trading advisor. Only select items from the provided list. Never suggest items not in the user's history." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1500
    });
    const content = response.choices[0]?.message?.content;
    console.log("[AI Recommendations] AI response received");
    if (!content) {
      console.log("[AI Recommendations] No content, using profit-sorted fallback");
      return getTopProfitItems(availableItems, profile);
    }
    const parsed = JSON.parse(content);
    const suggestions = parsed.items || parsed.recommendations || parsed.suggestions || [];
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      console.log("[AI Recommendations] No valid AI suggestions, using profit-sorted fallback");
      return getTopProfitItems(availableItems, profile);
    }
    const recommendations = [];
    for (const suggestion of suggestions.slice(0, 5)) {
      if (!suggestion?.itemName) continue;
      const itemData = availableItems.find(
        (i) => i.itemName.toLowerCase() === suggestion.itemName.toLowerCase()
      );
      if (!itemData) {
        console.log("[AI Recommendations] AI suggested unknown item:", suggestion.itemName);
        continue;
      }
      recommendations.push(buildRecommendation(itemData, profile, suggestion.reasoning || "Matches your trading style", {
        confidence: suggestion.confidence,
        matchScore: suggestion.matchScore,
        strategy: suggestion.suggestedStrategy,
        tips: suggestion.tips
      }));
    }
    if (recommendations.length < 5) {
      const existingNames = new Set(recommendations.map((r) => r.itemName.toLowerCase()));
      const remaining = availableItems.filter((i) => !existingNames.has(i.itemName.toLowerCase())).sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5 - recommendations.length);
      for (const item of remaining) {
        recommendations.push(buildRecommendation(item, profile, "Top profit performer from your history"));
      }
    }
    console.log("[AI Recommendations] Returning", recommendations.length, "recommendations from history");
    return recommendations;
  } catch (error) {
    console.error("[AI Recommendations] Error:", error);
    return getTopProfitItems(availableItems, profile);
  }
}
function buildRecommendation(item, profile, reasoning, aiData) {
  const potentialProfit = item.avgSellPrice - item.avgBuyPrice - Math.floor(item.avgSellPrice * 0.02);
  const potentialROI = item.avgBuyPrice > 0 ? potentialProfit / item.avgBuyPrice * 100 : 0;
  let confidence = "medium";
  if (aiData?.confidence === "high" || item.winRate >= 80) confidence = "high";
  else if (aiData?.confidence === "low" || item.winRate < 50) confidence = "low";
  const holdHours = item.avgHoldTimeMs / 36e5;
  let estimatedHoldTime = "1-3 days";
  if (holdHours < 4) estimatedHoldTime = "1-4 hours";
  else if (holdHours < 24) estimatedHoldTime = "4-24 hours";
  else if (holdHours < 72) estimatedHoldTime = "1-3 days";
  else estimatedHoldTime = "3+ days";
  let riskLevel = "medium";
  if (item.winRate >= 75 && item.avgROI > 0) riskLevel = "low";
  else if (item.winRate < 50 || item.avgROI < 0) riskLevel = "high";
  const matchReasons = [];
  if (item.winRate >= 70) matchReasons.push(`${item.winRate.toFixed(0)}% win rate`);
  if (item.avgROI > profile.avgROI) matchReasons.push("Above your average ROI");
  if (item.tradeCount >= 5) matchReasons.push(`${item.tradeCount} successful trades`);
  if (item.totalProfit > 0) matchReasons.push(`${formatGp(item.totalProfit)} total profit`);
  if (aiData?.tips) matchReasons.push(aiData.tips);
  return {
    itemName: item.itemName,
    itemId: item.itemId || 0,
    itemIcon: item.itemIcon || void 0,
    currentPrice: item.avgSellPrice,
    // Use their historical sell price as "current"
    suggestedBuyPrice: item.avgBuyPrice,
    suggestedSellPrice: item.avgSellPrice,
    potentialProfit,
    potentialROI,
    confidence,
    reasoning,
    matchScore: aiData?.matchScore || Math.round(50 + item.winRate / 2),
    matchReasons,
    strategy: aiData?.strategy || item.strategies[0] || "Other",
    riskLevel,
    estimatedHoldTime
  };
}
function getTopProfitItems(items, profile) {
  return items.sort((a, b) => b.totalProfit - a.totalProfit).slice(0, 5).map((item) => buildRecommendation(item, profile, "Top profit performer from your history"));
}
function formatGp(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toString();
}
function formatHoldTime(ms) {
  const hours = ms / 36e5;
  if (hours < 1) return "less than 1 hour";
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = hours / 24;
  return `${Math.round(days)} days`;
}

// shared/taxCalculator.ts
var GE_TAX_RATE = 0.02;
var BOND_ITEM_IDS = [
  29492,
  // Bond
  43998
  // Premier Club bond
];
function isBondItem(itemId) {
  if (!itemId) return false;
  return BOND_ITEM_IDS.includes(itemId);
}
function isTaxExempt(sellPrice, itemId, itemName) {
  if (itemId && isBondItem(itemId)) {
    return { exempt: true, reason: "Bonds are tax exempt" };
  }
  if (itemName && itemName.toLowerCase().includes("bond")) {
    return { exempt: true, reason: "Bonds are tax exempt" };
  }
  if (sellPrice <= 49) {
    return { exempt: true, reason: "Items sold for 49 gp or less are tax exempt" };
  }
  return { exempt: false };
}
function calculateFlipTax(sellPrice, buyPrice, quantity = 1, itemId, itemName) {
  const exemption = isTaxExempt(sellPrice, itemId, itemName);
  const taxPerItem = exemption.exempt ? 0 : Math.floor(sellPrice * GE_TAX_RATE);
  const totalTax = taxPerItem * quantity;
  const netSellPerItem = sellPrice - taxPerItem;
  const netSellTotal = sellPrice * quantity - totalTax;
  const grossSellTotal = sellPrice * quantity;
  const totalBuyCost = buyPrice * quantity;
  const profit = netSellTotal - totalBuyCost;
  const profitPerItem = quantity > 0 ? profit / quantity : 0;
  const roi = totalBuyCost > 0 ? profit / totalBuyCost * 100 : 0;
  return {
    taxPerItem,
    totalTax,
    netSellPerItem,
    netSellTotal,
    grossSellTotal,
    profit,
    profitPerItem,
    roi: Math.round(roi * 100) / 100,
    isTaxExempt: exemption.exempt,
    exemptReason: exemption.reason
  };
}

// shared/gpParser.ts
function formatGpShorthand(value) {
  if (value >= 1e9) {
    const billions = value / 1e9;
    return billions % 1 === 0 ? `${billions}B` : `${billions.toFixed(2).replace(/\.?0+$/, "")}B`;
  } else if (value >= 1e6) {
    const millions = value / 1e6;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(2).replace(/\.?0+$/, "")}M`;
  } else if (value >= 1e3) {
    const thousands = value / 1e3;
    return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1).replace(/\.?0+$/, "")}K`;
  }
  return value.toLocaleString();
}

// server/discord.ts
function formatDate(date) {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}
function getStatusAndColor(flip) {
  if (!flip.sellDate) {
    return { status: "\u{1F7E1} Open Position", color: 16096779 };
  }
  const buyTotal = Number(flip.buyPrice) * flip.quantity;
  const sellTotal = Number(flip.sellPrice || 0) * flip.quantity;
  const taxPerItem = Math.floor(Number(flip.sellPrice || 0) * 0.02);
  const totalTax = taxPerItem * flip.quantity;
  const profit = sellTotal - buyTotal - totalTax;
  if (profit > 0) {
    return { status: "\u{1F7E2} Profitable", color: 2278750 };
  } else if (profit < 0) {
    return { status: "\u{1F534} Loss", color: 15680580 };
  }
  return { status: "\u26AA Break Even", color: 7041664 };
}
async function sendFlipToDiscord(flip) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("[Discord] DISCORD_WEBHOOK_URL not configured, skipping notification");
    return false;
  }
  try {
    const { status, color } = getStatusAndColor(flip);
    const embed = {
      title: `\u{1F4CA} New Flip: ${flip.itemName}`,
      color,
      fields: [
        {
          name: "Buy Price",
          value: `${formatGpShorthand(Number(flip.buyPrice))} gp`,
          inline: true
        },
        {
          name: "Sell Price",
          value: flip.sellPrice ? `${formatGpShorthand(Number(flip.sellPrice))} gp` : "\u2014",
          inline: true
        },
        {
          name: "Quantity",
          value: flip.quantity.toLocaleString(),
          inline: true
        },
        {
          name: "Buy Date",
          value: formatDate(flip.buyDate),
          inline: true
        },
        {
          name: "Sell Date",
          value: formatDate(flip.sellDate),
          inline: true
        },
        {
          name: "Status",
          value: status,
          inline: true
        }
      ],
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      footer: {
        text: "FlipSync"
      }
    };
    const payload = {
      embeds: [embed]
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Discord] Webhook failed:", response.status, errorText);
      return false;
    }
    console.log("[Discord] Flip shared successfully:", flip.itemName);
    return true;
  } catch (error) {
    console.error("[Discord] Error sending webhook:", error);
    return false;
  }
}
async function sendFlipUpdateToDiscord(oldFlip, newFlip) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("[Discord] DISCORD_WEBHOOK_URL not configured, skipping notification");
    return false;
  }
  try {
    const changes = [];
    if (Number(oldFlip.buyPrice) !== Number(newFlip.buyPrice)) {
      changes.push({
        name: "Buy Price",
        value: `${formatGpShorthand(Number(oldFlip.buyPrice))} \u2192 ${formatGpShorthand(Number(newFlip.buyPrice))} gp`,
        inline: true
      });
    }
    if (Number(oldFlip.sellPrice || 0) !== Number(newFlip.sellPrice || 0)) {
      const wasCompleted = !oldFlip.sellPrice && newFlip.sellPrice;
      changes.push({
        name: wasCompleted ? "Sell Price (COMPLETED)" : "Sell Price",
        value: `${oldFlip.sellPrice ? formatGpShorthand(Number(oldFlip.sellPrice)) : "\u2014"} \u2192 ${newFlip.sellPrice ? formatGpShorthand(Number(newFlip.sellPrice)) : "\u2014"} gp`,
        inline: true
      });
    }
    if (oldFlip.quantity !== newFlip.quantity) {
      changes.push({
        name: "Quantity",
        value: `${oldFlip.quantity.toLocaleString()} \u2192 ${newFlip.quantity.toLocaleString()}`,
        inline: true
      });
    }
    if (oldFlip.strategyTag !== newFlip.strategyTag) {
      changes.push({
        name: "Strategy",
        value: `${oldFlip.strategyTag || "None"} \u2192 ${newFlip.strategyTag || "None"}`,
        inline: true
      });
    }
    if (oldFlip.notes !== newFlip.notes) {
      changes.push({
        name: "Notes",
        value: newFlip.notes ? newFlip.notes.length > 50 ? newFlip.notes.substring(0, 47) + "..." : newFlip.notes : "Removed",
        inline: false
      });
    }
    if (changes.length === 0) {
      console.log("[Discord] No changes detected, skipping update notification");
      return false;
    }
    const { status, color } = getStatusAndColor(newFlip);
    let profitField = null;
    if (newFlip.sellPrice && newFlip.sellDate) {
      const buyTotal = Number(newFlip.buyPrice) * newFlip.quantity;
      const sellTotal = Number(newFlip.sellPrice) * newFlip.quantity;
      const taxPerItem = Math.floor(Number(newFlip.sellPrice) * 0.02);
      const totalTax = taxPerItem * newFlip.quantity;
      const profit = sellTotal - buyTotal - totalTax;
      const roi = buyTotal > 0 ? (profit / buyTotal * 100).toFixed(1) : "0";
      profitField = {
        name: profit >= 0 ? "\u{1F4B0} Profit" : "\u{1F4C9} Loss",
        value: `${formatGpShorthand(Math.abs(profit))} gp (${roi}% ROI)`,
        inline: true
      };
    }
    const embed = {
      title: `\u270F\uFE0F Updated: ${newFlip.itemName}`,
      color,
      fields: [
        ...changes,
        {
          name: "Current Status",
          value: status,
          inline: true
        },
        ...profitField ? [profitField] : []
      ],
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      footer: {
        text: "FlipSync"
      }
    };
    const payload = {
      embeds: [embed]
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Discord] Webhook failed:", response.status, errorText);
      return false;
    }
    console.log("[Discord] Flip update shared successfully:", newFlip.itemName, `(${changes.length} changes)`);
    return true;
  } catch (error) {
    console.error("[Discord] Error sending webhook:", error);
    return false;
  }
}
async function sendDailySummaryToDiscord(userId, storage2) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return false;
  try {
    const flips2 = await storage2.getFlips(userId);
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const todaysFlips = flips2.filter((f) => {
      if (!f.sellDate) return false;
      const sellDate = new Date(f.sellDate);
      sellDate.setHours(0, 0, 0, 0);
      return sellDate.getTime() === today.getTime();
    });
    const todaysOpened = flips2.filter((f) => {
      const buyDate = new Date(f.buyDate);
      buyDate.setHours(0, 0, 0, 0);
      return buyDate.getTime() === today.getTime();
    });
    let totalProfit = 0;
    let wins = 0;
    let losses = 0;
    let bestTrade = null;
    let worstTrade = null;
    for (const flip of todaysFlips) {
      if (flip.sellPrice) {
        const taxPerItem = flip.sellPrice > 49 ? Math.floor(Number(flip.sellPrice) * 0.02) : 0;
        const totalTax = taxPerItem * flip.quantity;
        const profit = Number(flip.sellPrice) * flip.quantity - Number(flip.buyPrice) * flip.quantity - totalTax;
        totalProfit += profit;
        if (profit > 0) wins++;
        else losses++;
        if (!bestTrade || profit > bestTrade.profit) {
          bestTrade = { name: flip.itemName, profit };
        }
        if (!worstTrade || profit < worstTrade.profit) {
          worstTrade = { name: flip.itemName, profit };
        }
      }
    }
    const winRate = todaysFlips.length > 0 ? wins / todaysFlips.length * 100 : 0;
    const embed = {
      title: "Daily Trading Summary",
      color: totalProfit >= 0 ? 1096065 : 15680580,
      fields: [
        { name: "Net P&L", value: `${totalProfit >= 0 ? "+" : ""}${formatGpShorthand(totalProfit)} gp`, inline: true },
        { name: "Trades Completed", value: `${todaysFlips.length}`, inline: true },
        { name: "Win Rate", value: `${winRate.toFixed(0)}%`, inline: true },
        { name: "Wins / Losses", value: `${wins}W / ${losses}L`, inline: true },
        { name: "Positions Opened", value: `${todaysOpened.length}`, inline: true },
        ...bestTrade ? [{ name: "Best Trade", value: `${bestTrade.name}: +${formatGpShorthand(bestTrade.profit)} gp`, inline: false }] : [],
        ...worstTrade && worstTrade.profit < 0 ? [{ name: "Worst Trade", value: `${worstTrade.name}: ${formatGpShorthand(worstTrade.profit)} gp`, inline: false }] : []
      ],
      footer: { text: `FlipSync Daily Summary - ${(/* @__PURE__ */ new Date()).toLocaleDateString()}` },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });
    return true;
  } catch (error) {
    console.error("[Discord] Daily summary error:", error);
    return false;
  }
}
async function sendGoalAchievementToDiscord(achievement) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("[Discord] DISCORD_WEBHOOK_URL not configured, skipping goal notification");
    return false;
  }
  try {
    const goalTypeEmoji = {
      daily: "\u{1F305}",
      weekly: "\u{1F4C5}",
      monthly: "\u{1F5D3}\uFE0F"
    };
    const goalTypeLabel = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly"
    };
    const title = achievement.isFirstLoad ? `\u{1F4CA} ${goalTypeLabel[achievement.goalType]} Goal Status ${goalTypeEmoji[achievement.goalType]}` : `\u{1F389} Goal Achieved! ${goalTypeEmoji[achievement.goalType]}`;
    const footerText = achievement.isFirstLoad ? "FlipSync - Already crushing it! \u{1F4AA}" : "FlipSync - Congratulations! \u{1F3C6}";
    const embed = {
      title,
      color: achievement.isFirstLoad ? 3447003 : 16766720,
      // Blue for status, Gold for real-time
      fields: [
        {
          name: "Trader",
          value: achievement.username,
          inline: true
        },
        {
          name: "Goal Type",
          value: `${goalTypeLabel[achievement.goalType]} Goal`,
          inline: true
        },
        {
          name: "Target",
          value: `${formatGpShorthand(achievement.targetAmount)} gp`,
          inline: true
        },
        {
          name: "Current Profit",
          value: `${formatGpShorthand(achievement.currentProfit)} gp`,
          inline: true
        },
        {
          name: "Progress",
          value: `${Math.round(achievement.currentProfit / achievement.targetAmount * 100)}%`,
          inline: true
        }
      ],
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      footer: {
        text: footerText
      }
    };
    const payload = {
      embeds: [embed]
    };
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Discord] Goal achievement webhook failed:", response.status, errorText);
      return false;
    }
    console.log("[Discord] Goal achievement shared:", achievement.goalType, achievement.username);
    return true;
  } catch (error) {
    console.error("[Discord] Error sending goal achievement webhook:", error);
    return false;
  }
}

// server/routes.ts
import { startOfDay, startOfWeek, startOfMonth, isAfter } from "date-fns";
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
  // 10MB max
});
function calculateFlipProfit(flip) {
  if (!flip.sellPrice) return 0;
  const buyPrice = Number(flip.buyPrice);
  const sellPrice = Number(flip.sellPrice);
  const quantity = flip.quantity ?? 1;
  const gross = (sellPrice - buyPrice) * quantity;
  const taxCalc = calculateFlipTax(sellPrice, buyPrice, quantity, flip.itemId, flip.itemName);
  return gross - taxCalc.totalTax;
}
async function checkGoalAchievements(userId, username, previousProfits) {
  console.log("[GoalCheck] Starting achievement check for user:", username);
  console.log("[GoalCheck] Previous profits:", previousProfits);
  const now = /* @__PURE__ */ new Date();
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const flips2 = await storage.getFlips(userId);
  let dailyProfit = 0;
  let weeklyProfit = 0;
  let monthlyProfit = 0;
  for (const flip of flips2) {
    if (!flip.sellDate || !flip.sellPrice || flip.deletedAt) continue;
    const sellDate = new Date(flip.sellDate);
    const profit = calculateFlipProfit(flip);
    if (isAfter(sellDate, dayStart) || sellDate.getTime() === dayStart.getTime()) {
      dailyProfit += profit;
    }
    if (isAfter(sellDate, weekStart) || sellDate.getTime() === weekStart.getTime()) {
      weeklyProfit += profit;
    }
    if (isAfter(sellDate, monthStart) || sellDate.getTime() === monthStart.getTime()) {
      monthlyProfit += profit;
    }
  }
  console.log("[GoalCheck] Current profits - Daily:", dailyProfit, "Weekly:", weeklyProfit, "Monthly:", monthlyProfit);
  const goals = await storage.getProfitGoals(userId);
  console.log("[GoalCheck] User has", goals.length, "goals configured");
  const achievements = [];
  for (const goal of goals) {
    const goalType = goal.goalType;
    const target = Number(goal.targetAmount);
    let currentProfit = 0;
    let previousProfit = 0;
    switch (goalType) {
      case "daily":
        currentProfit = dailyProfit;
        previousProfit = previousProfits.daily;
        break;
      case "weekly":
        currentProfit = weeklyProfit;
        previousProfit = previousProfits.weekly;
        break;
      case "monthly":
        currentProfit = monthlyProfit;
        previousProfit = previousProfits.monthly;
        break;
    }
    console.log(`[GoalCheck] ${goalType} goal: target=${target}, previous=${previousProfit}, current=${currentProfit}`);
    console.log(`[GoalCheck] Check: previousProfit(${previousProfit}) < target(${target}) = ${previousProfit < target}`);
    console.log(`[GoalCheck] Check: currentProfit(${currentProfit}) >= target(${target}) = ${currentProfit >= target}`);
    if (previousProfit < target && currentProfit >= target) {
      console.log(`[GoalCheck] ACHIEVEMENT UNLOCKED: ${goalType} goal of ${target} reached!`);
      achievements.push({
        goalType,
        targetAmount: target,
        currentProfit,
        username
      });
    }
  }
  console.log("[GoalCheck] Total achievements found:", achievements.length);
  return achievements;
}
async function getCurrentProfits(userId) {
  const now = /* @__PURE__ */ new Date();
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);
  const flips2 = await storage.getFlips(userId);
  let daily = 0;
  let weekly = 0;
  let monthly = 0;
  for (const flip of flips2) {
    if (!flip.sellDate || !flip.sellPrice || flip.deletedAt) continue;
    const sellDate = new Date(flip.sellDate);
    const profit = calculateFlipProfit(flip);
    if (isAfter(sellDate, dayStart) || sellDate.getTime() === dayStart.getTime()) {
      daily += profit;
    }
    if (isAfter(sellDate, weekStart) || sellDate.getTime() === weekStart.getTime()) {
      weekly += profit;
    }
    if (isAfter(sellDate, monthStart) || sellDate.getTime() === monthStart.getTime()) {
      monthly += profit;
    }
  }
  return { daily, weekly, monthly };
}
var SERVER_START_TIME = Date.now().toString();
async function registerRoutes(app) {
  await setupAuth(app);
  app.get("/api/version", (req, res) => {
    res.json({ version: SERVER_START_TIME });
  });
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app.get("/api/ge/price", async (req, res) => {
    try {
      const { name } = req.query;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Item name required" });
      }
      const item = await getItemPrice(name);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch GE price" });
    }
  });
  app.get("/api/ge/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Search query required" });
      }
      const items = await searchItems(q);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to search items" });
    }
  });
  app.get("/api/ge/trend/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const itemId = parseInt(id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      const trend = await getItemTrend(itemId);
      if (!trend) {
        return res.status(404).json({ error: "Trend data not found" });
      }
      res.json(trend);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trend data" });
    }
  });
  app.get("/api/ge/history/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const itemId = parseInt(id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      const period = req.query.period || "daily";
      const validPeriods = ["daily", "weekly", "monthly", "yearly"];
      if (!validPeriods.includes(period)) {
        return res.status(400).json({ error: "Invalid period. Use: daily, weekly, monthly, yearly" });
      }
      const history = await getItemPriceHistory(itemId, period);
      if (!history) {
        return res.status(404).json({ error: "Price history not found" });
      }
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price history" });
    }
  });
  app.get("/api/ge/suggestions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const itemId = parseInt(id);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      const suggestions = await getItemSuggestions(itemId);
      if (!suggestions) {
        return res.status(404).json({ error: "Unable to generate suggestions" });
      }
      const transactions = await storage.getTransactionsByItem(itemId, 100);
      if (transactions.length > 0) {
        const buyTransactions = transactions.filter((t) => t.transactionType === "buy");
        const sellTransactions = transactions.filter((t) => t.transactionType === "sell");
        const avgUserBuyPrice = buyTransactions.length > 0 ? Math.round(buyTransactions.reduce((sum, t) => sum + t.price, 0) / buyTransactions.length) : null;
        const avgUserSellPrice = sellTransactions.length > 0 ? Math.round(sellTransactions.reduce((sum, t) => sum + t.price, 0) / sellTransactions.length) : null;
        const totalUserVolume = transactions.reduce((sum, t) => sum + (t.totalValue || 0), 0);
        res.json({
          ...suggestions,
          communityData: {
            totalTransactions: transactions.length,
            buyTransactions: buyTransactions.length,
            sellTransactions: sellTransactions.length,
            avgUserBuyPrice,
            avgUserSellPrice,
            totalVolume: totalUserVolume,
            dataSource: "RS3 Flip Tracker community trades"
          }
        });
      } else {
        res.json({
          ...suggestions,
          communityData: null
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });
  app.get("/api/ai/trading-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips2 = await storage.getFlips(userId);
      const profile = analyzeUserTradingProfile(flips2);
      res.json(profile);
    } catch (error) {
      console.error("Error analyzing trading profile:", error);
      res.status(500).json({ error: "Failed to analyze trading profile" });
    }
  });
  app.get("/api/ai/recommendations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips2 = await storage.getFlips(userId);
      if (flips2.length < 3) {
        return res.json({
          recommendations: [],
          message: "Complete at least 3 flips to get personalized recommendations",
          profile: null
        });
      }
      const profile = analyzeUserTradingProfile(flips2);
      const recommendations = await getPersonalizedRecommendations(profile, flips2);
      res.json({
        recommendations,
        profile,
        message: recommendations.length > 0 ? null : "No recommendations available at this time"
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });
  const ADMIN_EMAILS = [
    "fjnovarum@gmail.com",
    "bjimenez@virtualsyncsolutions.com"
  ];
  app.get("/api/flips", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user && (ADMIN_EMAILS.includes(user.email ?? "") || user.isAdmin === true);
      const scope = req.query.scope;
      const filterUserId = req.query.userId;
      if (!isAdminUser) {
        if (scope === "all" || filterUserId) {
          return res.status(403).json({ error: "Admin access required to view other users' flips" });
        }
        const userFlips = await storage.getFlips(userId);
        return res.json(userFlips);
      }
      if (scope === "all") {
        const allFlips = await storage.getAllFlips();
        if (filterUserId) {
          const filteredFlips = allFlips.filter((flip) => flip.userId === filterUserId);
          return res.json(filteredFlips);
        }
        return res.json(allFlips);
      }
      const adminFlips = await storage.getFlips(userId);
      res.json(adminFlips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flips" });
    }
  });
  app.post("/api/flips", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const validatedFlip = insertFlipSchema.parse(req.body);
      if (validatedFlip.sellPrice && !validatedFlip.sellDate) {
        validatedFlip.sellDate = /* @__PURE__ */ new Date();
        console.log("[FlipCreate] Auto-setting sellDate to today since sellPrice was provided");
      }
      const previousProfits = await getCurrentProfits(userId);
      const newFlip = await storage.createFlip(userId, validatedFlip);
      if (newFlip.itemId) {
        await storage.recordTransaction({
          flipId: newFlip.id,
          userId,
          itemId: newFlip.itemId,
          itemName: newFlip.itemName,
          transactionType: "buy",
          price: newFlip.buyPrice,
          quantity: newFlip.quantity ?? 1,
          strategyTag: newFlip.strategyTag ?? void 0,
          transactionDate: new Date(newFlip.buyDate)
        });
        await storage.updateItemVolume(
          newFlip.itemId,
          newFlip.itemName,
          new Date(newFlip.buyDate),
          "buy",
          newFlip.buyPrice,
          newFlip.quantity ?? 1
        );
        if (newFlip.sellPrice && newFlip.sellDate) {
          const sellValue = newFlip.sellPrice * (newFlip.quantity ?? 1);
          const taxPaid = newFlip.tradeType === "street" ? 0 : Math.floor(newFlip.sellPrice * 0.02) * (newFlip.quantity ?? 1);
          await storage.recordTransaction({
            flipId: newFlip.id,
            userId,
            itemId: newFlip.itemId,
            itemName: newFlip.itemName,
            transactionType: "sell",
            price: newFlip.sellPrice,
            quantity: newFlip.quantity ?? 1,
            taxPaid,
            strategyTag: newFlip.strategyTag ?? void 0,
            transactionDate: new Date(newFlip.sellDate)
          });
          await storage.updateItemVolume(
            newFlip.itemId,
            newFlip.itemName,
            new Date(newFlip.sellDate),
            "sell",
            newFlip.sellPrice,
            newFlip.quantity ?? 1
          );
        }
      }
      sendFlipToDiscord(newFlip).catch((err) => {
        console.error("[Discord] Failed to send flip:", err);
      });
      let achievements = [];
      console.log("[FlipCreate] Checking for completed flip - sellPrice:", newFlip.sellPrice, "sellDate:", newFlip.sellDate);
      if (newFlip.sellPrice && newFlip.sellDate && user) {
        console.log("[FlipCreate] Flip is completed, running goal achievement check...");
        achievements = await checkGoalAchievements(userId, user.firstName || user.email || "Trader", previousProfits);
        for (const achievement of achievements) {
          sendGoalAchievementToDiscord(achievement).catch((err) => {
            console.error("[Discord] Failed to send goal achievement:", err);
          });
        }
        console.log("[FlipCreate] Achievements returned:", achievements.length);
      } else {
        console.log("[FlipCreate] Flip is NOT completed (missing sellPrice or sellDate), skipping goal check");
      }
      res.status(201).json({ ...newFlip, achievements });
    } catch (error) {
      res.status(400).json({ error: "Invalid flip data" });
    }
  });
  app.patch("/api/flips/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user && (ADMIN_EMAILS.includes(user.email ?? "") || user.isAdmin === true);
      const existingFlip = await storage.getFlip(id);
      const flipOwnerId = existingFlip?.userId || userId;
      const flipOwner = existingFlip?.userId ? await storage.getUser(existingFlip.userId) : user;
      const previousProfits = await getCurrentProfits(flipOwnerId);
      const validatedFlip = insertFlipSchema.partial().parse(req.body);
      if (validatedFlip.sellPrice && !validatedFlip.sellDate && !existingFlip?.sellDate) {
        validatedFlip.sellDate = /* @__PURE__ */ new Date();
        console.log("[FlipUpdate] Auto-setting sellDate to today since sellPrice was provided");
      }
      const updatedFlip = await storage.updateFlip(id, userId, validatedFlip, isAdminUser);
      if (!updatedFlip) {
        return res.status(404).json({ error: "Flip not found" });
      }
      if (updatedFlip.itemId && updatedFlip.sellPrice && updatedFlip.sellDate && (!existingFlip?.sellPrice || existingFlip.sellPrice !== updatedFlip.sellPrice)) {
        const sellValue = updatedFlip.sellPrice * (updatedFlip.quantity ?? 1);
        const taxPaid = updatedFlip.tradeType === "street" ? 0 : Math.floor(updatedFlip.sellPrice * 0.02) * (updatedFlip.quantity ?? 1);
        await storage.recordTransaction({
          flipId: updatedFlip.id,
          userId: updatedFlip.userId,
          itemId: updatedFlip.itemId,
          itemName: updatedFlip.itemName,
          transactionType: "sell",
          price: updatedFlip.sellPrice,
          quantity: updatedFlip.quantity ?? 1,
          taxPaid,
          strategyTag: updatedFlip.strategyTag ?? void 0,
          transactionDate: new Date(updatedFlip.sellDate)
        });
        await storage.updateItemVolume(
          updatedFlip.itemId,
          updatedFlip.itemName,
          new Date(updatedFlip.sellDate),
          "sell",
          updatedFlip.sellPrice,
          updatedFlip.quantity ?? 1
        );
      }
      if (existingFlip) {
        sendFlipUpdateToDiscord(existingFlip, updatedFlip).catch((err) => {
          console.error("[Discord] Failed to send flip update:", err);
        });
      }
      let achievements = [];
      const isNewlyCompleted = updatedFlip.sellPrice && updatedFlip.sellDate && (!existingFlip?.sellPrice || existingFlip.sellPrice !== updatedFlip.sellPrice);
      if (isNewlyCompleted && flipOwner) {
        achievements = await checkGoalAchievements(
          flipOwnerId,
          flipOwner.firstName || flipOwner.email || "Trader",
          previousProfits
        );
        for (const achievement of achievements) {
          sendGoalAchievementToDiscord(achievement).catch((err) => {
            console.error("[Discord] Failed to send goal achievement:", err);
          });
        }
      }
      res.json({ ...updatedFlip, achievements });
    } catch (error) {
      res.status(400).json({ error: "Invalid flip data" });
    }
  });
  app.delete("/api/flips/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { soft } = req.query;
      if (soft === "true") {
        const deletedFlip = await storage.softDeleteFlip(id, userId);
        if (!deletedFlip) {
          return res.status(404).json({ error: "Flip not found" });
        }
        res.json(deletedFlip);
      } else {
        const success = await storage.deleteFlip(id, userId);
        if (!success) {
          return res.status(404).json({ error: "Flip not found" });
        }
        res.status(204).send();
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete flip" });
    }
  });
  app.post("/api/flips/:id/restore", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const restoredFlip = await storage.restoreFlip(id, userId);
      if (!restoredFlip) {
        return res.status(404).json({ error: "Flip not found" });
      }
      res.json(restoredFlip);
    } catch (error) {
      res.status(500).json({ error: "Failed to restore flip" });
    }
  });
  app.get("/api/stats/item-summary", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips2 = await storage.getFlips(userId);
      const completedFlips = flips2.filter((f) => f.sellDate !== null);
      const itemStats = /* @__PURE__ */ new Map();
      for (const flip of completedFlips) {
        const key = flip.itemName;
        const existing = itemStats.get(key) || {
          itemName: flip.itemName,
          itemId: flip.itemId,
          itemIcon: flip.itemIcon,
          totalProfit: 0,
          totalQuantity: 0,
          totalBuyCost: 0,
          tradeCount: 0,
          wins: 0,
          roiSum: 0,
          avgHoldTime: []
        };
        if (flip.sellPrice !== null && flip.sellPrice !== void 0) {
          const taxDetails = calculateFlipTax(
            flip.sellPrice,
            flip.buyPrice,
            flip.quantity,
            flip.itemId ?? void 0,
            flip.itemName
          );
          const profit = taxDetails.profit;
          const roi = taxDetails.roi;
          const totalBuyCost = flip.buyPrice * flip.quantity;
          existing.totalProfit += profit;
          existing.totalQuantity += flip.quantity;
          existing.totalBuyCost += totalBuyCost;
          existing.tradeCount += 1;
          existing.roiSum += roi;
          if (profit > 0) existing.wins += 1;
          if (flip.buyDate && flip.sellDate) {
            const holdDays = Math.floor(
              (new Date(flip.sellDate).getTime() - new Date(flip.buyDate).getTime()) / (1e3 * 60 * 60 * 24)
            );
            existing.avgHoldTime.push(holdDays);
          }
          if (flip.itemIcon && !existing.itemIcon) {
            existing.itemIcon = flip.itemIcon;
          }
          if (flip.itemId && !existing.itemId) {
            existing.itemId = flip.itemId;
          }
        }
        itemStats.set(key, existing);
      }
      const result = Array.from(itemStats.values()).map((item) => ({
        itemName: item.itemName,
        itemId: item.itemId,
        itemIcon: item.itemIcon,
        totalProfit: Math.round(item.totalProfit),
        totalQuantity: item.totalQuantity,
        tradeCount: item.tradeCount,
        avgROI: item.tradeCount > 0 ? Math.round(item.roiSum / item.tradeCount * 100) / 100 : 0,
        winRate: item.tradeCount > 0 ? Math.round(item.wins / item.tradeCount * 100 * 10) / 10 : 0,
        avgHoldTime: item.avgHoldTime.length > 0 ? Math.round(item.avgHoldTime.reduce((a, b) => a + b, 0) / item.avgHoldTime.length) : 0
      }));
      result.sort((a, b) => b.totalProfit - a.totalProfit);
      res.json(result);
    } catch (error) {
      console.error("Failed to get item summary:", error);
      res.status(500).json({ error: "Failed to fetch item summary" });
    }
  });
  app.get("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getWatchlist(userId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });
  app.post("/api/watchlist", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedItem = insertWatchlistSchema.parse(req.body);
      const newItem = await storage.createWatchlistItem(userId, validatedItem);
      res.status(201).json(newItem);
    } catch (error) {
      res.status(400).json({ error: "Invalid watchlist item data" });
    }
  });
  app.patch("/api/watchlist/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const validatedItem = insertWatchlistSchema.partial().parse(req.body);
      const updatedItem = await storage.updateWatchlistItem(id, userId, validatedItem);
      if (!updatedItem) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      res.json(updatedItem);
    } catch (error) {
      res.status(400).json({ error: "Invalid watchlist item data" });
    }
  });
  app.delete("/api/watchlist/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deleteWatchlistItem(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Watchlist item not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete watchlist item" });
    }
  });
  app.get("/api/community-prices", isAuthenticated, async (req, res) => {
    try {
      const allFlips = await storage.getAllFlips();
      const completedFlips = allFlips.filter((f) => f.sellPrice && !f.deletedAt);
      const itemMap = /* @__PURE__ */ new Map();
      for (const flip of completedFlips) {
        if (!flip.itemId) continue;
        const existing = itemMap.get(flip.itemId);
        const buyPrice = Number(flip.buyPrice);
        const sellPrice = Number(flip.sellPrice);
        const profit = (sellPrice - buyPrice) * flip.quantity;
        const taxDetails = calculateFlipTax(sellPrice, buyPrice, flip.quantity, flip.itemId ? Number(flip.itemId) : void 0, flip.itemName);
        const netProfit = taxDetails.profit;
        const roi = buyPrice > 0 ? netProfit / (buyPrice * flip.quantity) * 100 : 0;
        const tradeDate = flip.sellDate || flip.buyDate;
        if (existing) {
          existing.buyPrices.push(buyPrice);
          existing.sellPrices.push(sellPrice);
          existing.profits.push(netProfit);
          existing.rois.push(roi);
          existing.traders.add(flip.userId);
          if (tradeDate > existing.lastTradeDate) {
            existing.lastTradeDate = tradeDate;
          }
        } else {
          itemMap.set(flip.itemId, {
            itemId: flip.itemId,
            itemName: flip.itemName,
            itemIcon: flip.itemIcon || void 0,
            buyPrices: [buyPrice],
            sellPrices: [sellPrice],
            profits: [netProfit],
            rois: [roi],
            traders: /* @__PURE__ */ new Set([flip.userId]),
            lastTradeDate: tradeDate
          });
        }
      }
      const result = await Promise.all(Array.from(itemMap.values()).map(async (item) => {
        const avgBuy = Math.round(item.buyPrices.reduce((a, b) => a + b, 0) / item.buyPrices.length);
        const avgSell = Math.round(item.sellPrices.reduce((a, b) => a + b, 0) / item.sellPrices.length);
        const avgProfit = Math.round(item.profits.reduce((a, b) => a + b, 0) / item.profits.length);
        const avgRoi = item.rois.reduce((a, b) => a + b, 0) / item.rois.length;
        const tradeCount = item.buyPrices.length;
        const uniqueTraders = item.traders.size;
        const daysSinceLastTrade = Math.floor((Date.now() - item.lastTradeDate.getTime()) / (1e3 * 60 * 60 * 24));
        let gePriceValue = 0;
        try {
          const geData = await getItemPrice(item.itemName);
          if (geData) gePriceValue = geData.price;
        } catch {
        }
        let confidence = "low";
        if (tradeCount >= 10 && uniqueTraders >= 3 && daysSinceLastTrade <= 7) {
          confidence = "high";
        } else if (tradeCount >= 5 && uniqueTraders >= 2 && daysSinceLastTrade <= 14) {
          confidence = "medium";
        }
        const communityAvg = Math.round((avgBuy + avgSell) / 2);
        const priceAccuracy = gePriceValue > 0 ? Math.round((1 - Math.abs(communityAvg - gePriceValue) / gePriceValue) * 100) : 0;
        return {
          itemId: item.itemId,
          itemName: item.itemName,
          itemIcon: item.itemIcon,
          gePriceValue,
          communityBuyPrice: avgBuy,
          communitySellPrice: avgSell,
          tradeCount,
          uniqueTraders,
          lastTradeDate: item.lastTradeDate.toISOString(),
          avgProfit,
          avgRoi: Math.round(avgRoi * 100) / 100,
          confidence,
          priceAccuracy
        };
      }));
      const filtered = result.filter((r) => r.tradeCount >= 1);
      filtered.sort((a, b) => b.tradeCount - a.tradeCount);
      res.json(filtered.slice(0, 50));
    } catch (error) {
      console.error("Failed to get community prices:", error);
      res.status(500).json({ error: "Failed to fetch community prices" });
    }
  });
  app.get("/api/community-prices/hot", isAuthenticated, async (req, res) => {
    try {
      const allFlips = await storage.getAllFlips();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
      const recentFlips = allFlips.filter(
        (f) => f.sellPrice && !f.deletedAt && (f.sellDate || f.buyDate) >= sevenDaysAgo
      );
      const itemCounts = /* @__PURE__ */ new Map();
      for (const flip of recentFlips) {
        if (!flip.itemId) continue;
        const existing = itemCounts.get(flip.itemId);
        if (existing) {
          existing.tradeCount++;
          existing.traders.add(flip.userId);
        } else {
          itemCounts.set(flip.itemId, {
            itemId: flip.itemId,
            itemName: flip.itemName,
            itemIcon: flip.itemIcon || void 0,
            tradeCount: 1,
            traders: /* @__PURE__ */ new Set([flip.userId])
          });
        }
      }
      const result = Array.from(itemCounts.values()).map((item) => ({
        itemId: item.itemId,
        itemName: item.itemName,
        itemIcon: item.itemIcon,
        tradeCount: item.tradeCount,
        uniqueTraders: item.traders.size,
        confidence: item.tradeCount >= 5 && item.traders.size >= 2 ? "high" : item.tradeCount >= 2 ? "medium" : "low"
      }));
      result.sort((a, b) => b.tradeCount - a.tradeCount);
      res.json(result.slice(0, 10));
    } catch (error) {
      console.error("Failed to get hot items:", error);
      res.status(500).json({ error: "Failed to fetch hot items" });
    }
  });
  app.get("/api/community-prices/lookup", isAuthenticated, async (req, res) => {
    try {
      const itemId = parseInt(req.query.itemId);
      const itemName = req.query.itemName;
      if (isNaN(itemId) && !itemName) {
        return res.status(400).json({ error: "Invalid item ID or name" });
      }
      const allFlips = await storage.getAllFlips();
      const itemFlips = allFlips.filter((f) => {
        if (!f.sellPrice || f.deletedAt) return false;
        if (f.itemId === itemId) return true;
        if (itemName && f.itemName.toLowerCase() === itemName.toLowerCase()) return true;
        return false;
      });
      if (itemFlips.length === 0) {
        return res.json(null);
      }
      const buyPrices = itemFlips.map((f) => Number(f.buyPrice));
      const sellPrices = itemFlips.map((f) => Number(f.sellPrice));
      const traders = new Set(itemFlips.map((f) => f.userId));
      const latestTrade = itemFlips.reduce((latest, f) => {
        const date = f.sellDate || f.buyDate;
        return date > latest ? date : latest;
      }, itemFlips[0].sellDate || itemFlips[0].buyDate);
      const avgBuy = Math.round(buyPrices.reduce((a, b) => a + b, 0) / buyPrices.length);
      const avgSell = Math.round(sellPrices.reduce((a, b) => a + b, 0) / sellPrices.length);
      const tradeCount = itemFlips.length;
      const uniqueTraders = traders.size;
      const daysSinceLastTrade = Math.floor((Date.now() - latestTrade.getTime()) / (1e3 * 60 * 60 * 24));
      let confidence = "low";
      if (tradeCount >= 10 && uniqueTraders >= 3 && daysSinceLastTrade <= 7) {
        confidence = "high";
      } else if (tradeCount >= 5 && uniqueTraders >= 2 && daysSinceLastTrade <= 14) {
        confidence = "medium";
      }
      const profits = itemFlips.map((f) => {
        const buyPrice = Number(f.buyPrice);
        const sellPrice = Number(f.sellPrice);
        const td = calculateFlipTax(sellPrice, buyPrice, f.quantity, f.itemId ? Number(f.itemId) : void 0, f.itemName);
        return td.profit;
      });
      const rois = itemFlips.map((f) => {
        const buyPrice = Number(f.buyPrice);
        const sellPrice = Number(f.sellPrice);
        const td = calculateFlipTax(sellPrice, buyPrice, f.quantity, f.itemId ? Number(f.itemId) : void 0, f.itemName);
        return buyPrice > 0 ? td.profit / (buyPrice * f.quantity) * 100 : 0;
      });
      let gePriceValue = 0;
      try {
        const geData = await getItemPrice(itemFlips[0].itemName);
        if (geData) gePriceValue = geData.price;
      } catch {
      }
      res.json({
        itemId,
        itemName: itemFlips[0].itemName,
        itemIcon: itemFlips[0].itemIcon,
        gePriceValue,
        communityBuyPrice: avgBuy,
        communitySellPrice: avgSell,
        tradeCount,
        uniqueTraders,
        lastTradeDate: latestTrade.toISOString(),
        avgProfit: Math.round(profits.reduce((a, b) => a + b, 0) / profits.length),
        avgRoi: Math.round(rois.reduce((a, b) => a + b, 0) / rois.length * 100) / 100,
        confidence,
        priceAccuracy: 0
      });
    } catch (error) {
      console.error("Failed to lookup community price:", error);
      res.status(500).json({ error: "Failed to lookup community price" });
    }
  });
  app.get("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const alerts = await storage.getPriceAlerts(userId);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price alerts" });
    }
  });
  app.post("/api/alerts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedAlert = insertPriceAlertSchema.parse(req.body);
      const newAlert = await storage.createPriceAlert(userId, validatedAlert);
      res.status(201).json(newAlert);
    } catch (error) {
      res.status(400).json({ error: "Invalid price alert data" });
    }
  });
  app.patch("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const validatedAlert = insertPriceAlertSchema.partial().parse(req.body);
      const updatedAlert = await storage.updatePriceAlert(id, userId, validatedAlert);
      if (!updatedAlert) {
        return res.status(404).json({ error: "Price alert not found" });
      }
      res.json(updatedAlert);
    } catch (error) {
      res.status(400).json({ error: "Invalid price alert data" });
    }
  });
  app.delete("/api/alerts/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deletePriceAlert(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Price alert not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete price alert" });
    }
  });
  app.get("/api/scanner/items", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user && (ADMIN_EMAILS.includes(user.email ?? "") || user.isAdmin === true);
      if (!isAdminUser) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const items = await getAllItemsForScanner();
      res.json(items);
    } catch (error) {
      console.error("Error fetching scanner items:", error);
      res.status(500).json({ error: "Failed to fetch scanner items" });
    }
  });
  app.get("/api/scanner/item/:itemId/detail", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const isAdminUser = user && (ADMIN_EMAILS.includes(user.email ?? "") || user.isAdmin === true);
      if (!isAdminUser) {
        return res.status(403).json({ error: "Admin access required" });
      }
      const itemId = parseInt(req.params.itemId, 10);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      let indicators = null;
      let range7d = null;
      let range30d = null;
      try {
        const fullHistory = await getItemPriceHistoryFull(itemId);
        if (fullHistory) {
          if (fullHistory.monthly.length > 0) {
            indicators = calculateTechnicalIndicators(fullHistory.monthly);
          }
          if (fullHistory.daily.length > 0) {
            range7d = calculateObservableRange(fullHistory.daily, 7);
            range30d = calculateObservableRange(fullHistory.daily, 30);
          }
        }
      } catch (err) {
        console.error(`Failed to get price history for item ${itemId}:`, err);
      }
      const currentPrice = indicators?.sma7 ?? 0;
      const smartPricingBase = calculateSmartPricing(
        currentPrice,
        indicators,
        null
      );
      const userFlips = await storage.getUserFlipsByItemId(userId, itemId);
      const tradeStats = calculateTradeHistoryStats(
        userFlips.map((f) => ({
          buyPrice: f.buyPrice,
          sellPrice: f.sellPrice,
          quantity: f.quantity,
          buyDate: f.buyDate,
          sellDate: f.sellDate,
          itemId: f.itemId,
          itemName: f.itemName
        })),
        smartPricingBase.suggestedMarginPct
      );
      res.json({
        itemId,
        indicators,
        tradeStats,
        range7d,
        range30d
      });
    } catch (error) {
      console.error("Error fetching scanner item detail:", error);
      res.status(500).json({ error: "Failed to fetch item detail" });
    }
  });
  app.get("/api/favorites", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites2 = await storage.getFavorites(userId);
      res.json(favorites2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });
  app.post("/api/favorites", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedFavorite = insertFavoriteSchema.parse(req.body);
      const newFavorite = await storage.createFavorite(userId, validatedFavorite);
      res.status(201).json(newFavorite);
    } catch (error) {
      res.status(400).json({ error: "Invalid favorite data" });
    }
  });
  app.delete("/api/favorites/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deleteFavorite(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Favorite not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete favorite" });
    }
  });
  app.get("/api/goals", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const goals = await storage.getProfitGoals(userId);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profit goals" });
    }
  });
  app.post("/api/goals", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedGoal = insertProfitGoalSchema.parse(req.body);
      const newGoal = await storage.createProfitGoal(userId, validatedGoal);
      res.status(201).json(newGoal);
    } catch (error) {
      res.status(400).json({ error: "Invalid profit goal data" });
    }
  });
  app.patch("/api/goals/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const validatedGoal = insertProfitGoalSchema.partial().parse(req.body);
      const updatedGoal = await storage.updateProfitGoal(id, userId, validatedGoal);
      if (!updatedGoal) {
        return res.status(404).json({ error: "Profit goal not found" });
      }
      res.json(updatedGoal);
    } catch (error) {
      res.status(400).json({ error: "Invalid profit goal data" });
    }
  });
  app.delete("/api/goals/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deleteProfitGoal(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Profit goal not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete profit goal" });
    }
  });
  app.get("/api/goals/check-met", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const currentProfits = await getCurrentProfits(userId);
      const goals = await storage.getProfitGoals(userId);
      const metGoals = [];
      for (const goal of goals) {
        const goalType = goal.goalType;
        const target = Number(goal.targetAmount);
        let currentProfit = 0;
        switch (goalType) {
          case "daily":
            currentProfit = currentProfits.daily;
            break;
          case "weekly":
            currentProfit = currentProfits.weekly;
            break;
          case "monthly":
            currentProfit = currentProfits.monthly;
            break;
        }
        if (currentProfit >= target) {
          metGoals.push({
            goalType,
            targetAmount: target,
            currentProfit,
            username: user?.firstName || user?.email || "Trader"
          });
        }
      }
      console.log("[GoalCheck] Goals currently met:", metGoals.length, "of", goals.length);
      res.json({ metGoals, currentProfits });
    } catch (error) {
      console.error("[GoalCheck] Error checking met goals:", error);
      res.status(500).json({ error: "Failed to check goals" });
    }
  });
  app.post("/api/goals/notify-achievement", isAuthenticated, async (req, res) => {
    try {
      const { goalType, targetAmount, currentProfit, username, isFirstLoad } = req.body;
      if (!goalType || !targetAmount) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const achievement = {
        goalType,
        targetAmount: Number(targetAmount),
        currentProfit: Number(currentProfit),
        username: username || "Trader",
        isFirstLoad: isFirstLoad === true
      };
      console.log("[Discord] Sending first-load goal achievement:", achievement);
      await sendGoalAchievementToDiscord(achievement);
      res.json({ success: true });
    } catch (error) {
      console.error("[Discord] Failed to send goal achievement:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });
  app.get("/api/portfolio/categories", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const categories = await storage.getPortfolioCategories(userId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });
  app.post("/api/portfolio/categories", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedCategory = insertPortfolioCategorySchema.parse(req.body);
      const newCategory = await storage.createPortfolioCategory(userId, validatedCategory);
      res.status(201).json(newCategory);
    } catch (error) {
      res.status(400).json({ error: "Invalid category data" });
    }
  });
  app.patch("/api/portfolio/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const validatedCategory = insertPortfolioCategorySchema.partial().parse(req.body);
      const updatedCategory = await storage.updatePortfolioCategory(id, userId, validatedCategory);
      if (!updatedCategory) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updatedCategory);
    } catch (error) {
      res.status(400).json({ error: "Invalid category data" });
    }
  });
  app.delete("/api/portfolio/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deletePortfolioCategory(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });
  app.get("/api/portfolio/holdings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      res.json(holdings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch holdings" });
    }
  });
  app.post("/api/portfolio/holdings", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedHolding = insertPortfolioHoldingSchema.parse(req.body);
      const newHolding = await storage.createPortfolioHolding(userId, validatedHolding);
      res.status(201).json(newHolding);
    } catch (error) {
      res.status(400).json({ error: "Invalid holding data" });
    }
  });
  app.patch("/api/portfolio/holdings/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const validatedHolding = updatePortfolioHoldingSchema.parse(req.body);
      const holdingData = {
        ...validatedHolding,
        notes: validatedHolding.notes === null ? void 0 : validatedHolding.notes,
        categoryId: validatedHolding.categoryId === null ? void 0 : validatedHolding.categoryId
      };
      const updatedHolding = await storage.updatePortfolioHolding(id, userId, holdingData);
      if (!updatedHolding) {
        return res.status(404).json({ error: "Holding not found" });
      }
      res.json(updatedHolding);
    } catch (error) {
      res.status(400).json({ error: "Invalid holding data" });
    }
  });
  app.delete("/api/portfolio/holdings/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deletePortfolioHolding(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Holding not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete holding" });
    }
  });
  app.get("/api/portfolio/holdings/:holdingId/transactions", isAuthenticated, async (req, res) => {
    try {
      const { holdingId } = req.params;
      const userId = req.user.claims.sub;
      const transactions = await storage.getHoldingTransactions(holdingId, userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  app.post("/api/portfolio/holdings/:holdingId/transactions", isAuthenticated, async (req, res) => {
    try {
      const { holdingId } = req.params;
      const userId = req.user.claims.sub;
      const holding = await storage.getPortfolioHolding(holdingId);
      if (!holding || holding.userId !== userId) {
        return res.status(404).json({ error: "Holding not found" });
      }
      const validatedTx = insertHoldingTransactionSchema.parse({
        ...req.body,
        holdingId
      });
      if (validatedTx.transactionType === "sell") {
        if (validatedTx.quantity > holding.quantity) {
          return res.status(400).json({
            error: `Cannot sell ${validatedTx.quantity} units - only ${holding.quantity} held`
          });
        }
      }
      const newTx = await storage.createHoldingTransaction(userId, validatedTx);
      const allTxs = await storage.getHoldingTransactions(holdingId, userId);
      let totalQuantity = 0;
      let totalCost = 0;
      let realizedProfit = 0;
      let realizedLoss = 0;
      const sortedTxs = [...allTxs].sort(
        (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );
      for (const tx of sortedTxs) {
        if (tx.transactionType === "buy") {
          totalCost += tx.totalValue;
          totalQuantity += tx.quantity;
        } else if (tx.transactionType === "sell") {
          const avgCostPerUnit = totalQuantity > 0 ? totalCost / totalQuantity : 0;
          const costBasis = avgCostPerUnit * tx.quantity;
          const proceeds = tx.totalValue - (tx.fees || 0);
          const pnl = proceeds - costBasis;
          if (pnl >= 0) {
            realizedProfit += pnl;
          } else {
            realizedLoss += Math.abs(pnl);
          }
          totalCost = Math.max(0, totalCost - costBasis);
          totalQuantity = Math.max(0, totalQuantity - tx.quantity);
        }
      }
      const avgBuyPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      await storage.updatePortfolioHolding(holdingId, userId, {
        quantity: totalQuantity,
        avgBuyPrice: Math.round(avgBuyPrice),
        totalCost: Math.round(totalCost),
        realizedProfit: Math.round(realizedProfit),
        realizedLoss: Math.round(realizedLoss)
      });
      res.status(201).json(newTx);
    } catch (error) {
      console.error("Failed to create transaction:", error);
      res.status(400).json({ error: "Invalid transaction data" });
    }
  });
  app.delete("/api/portfolio/holdings/:holdingId/transactions/:txId", isAuthenticated, async (req, res) => {
    try {
      const { holdingId, txId } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deleteHoldingTransaction(txId, userId);
      if (!success) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      const allTxs = await storage.getHoldingTransactions(holdingId, userId);
      let totalQuantity = 0;
      let totalCost = 0;
      let realizedProfit = 0;
      let realizedLoss = 0;
      const sortedTxs = [...allTxs].sort(
        (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );
      for (const tx of sortedTxs) {
        if (tx.transactionType === "buy") {
          totalCost += tx.totalValue;
          totalQuantity += tx.quantity;
        } else if (tx.transactionType === "sell") {
          const avgCostPerUnit = totalQuantity > 0 ? totalCost / totalQuantity : 0;
          const costBasis = avgCostPerUnit * tx.quantity;
          const proceeds = tx.totalValue - (tx.fees || 0);
          const pnl = proceeds - costBasis;
          if (pnl >= 0) {
            realizedProfit += pnl;
          } else {
            realizedLoss += Math.abs(pnl);
          }
          totalCost -= costBasis;
          totalQuantity -= tx.quantity;
        }
      }
      const avgBuyPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      await storage.updatePortfolioHolding(holdingId, userId, {
        quantity: Math.max(0, totalQuantity),
        avgBuyPrice: Math.round(avgBuyPrice),
        totalCost: Math.round(Math.max(0, totalCost)),
        realizedProfit: Math.round(realizedProfit),
        realizedLoss: Math.round(realizedLoss)
      });
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });
  app.post("/api/portfolio/import/screenshot", isAuthenticated, upload.single("screenshot"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No screenshot uploaded" });
      }
      const aiResult = await analyzeRS3Screenshot(req.file.buffer);
      if (!aiResult.success) {
        console.warn("[Import] AI vision failed, falling back to OCR:", aiResult.error);
        const ocrResult = await processScreenshot(req.file.buffer);
        const matchedItems2 = await matchItemsToGE(ocrResult.items, async (query) => {
          const items = await searchItems(query);
          return items.slice(0, 5);
        });
        return res.json({
          items: matchedItems2,
          rawText: ocrResult.rawText,
          overallConfidence: ocrResult.overallConfidence,
          method: "ocr"
        });
      }
      const matchedItems = await Promise.all(
        aiResult.items.map(async (item) => {
          try {
            const searchResults = await searchItems(item.name);
            const bestMatch = searchResults.length > 0 ? searchResults[0] : null;
            return {
              original: {
                name: item.name,
                quantity: item.quantity,
                confidence: item.confidence
              },
              match: bestMatch,
              matchConfidence: bestMatch ? item.confidence * 0.9 : 0,
              notes: item.notes
            };
          } catch (e) {
            return {
              original: {
                name: item.name,
                quantity: item.quantity,
                confidence: item.confidence
              },
              match: null,
              matchConfidence: 0,
              notes: item.notes
            };
          }
        })
      );
      res.json({
        items: matchedItems,
        rawText: aiResult.rawResponse,
        overallConfidence: matchedItems.length > 0 ? matchedItems.reduce((sum, i) => sum + i.original.confidence, 0) / matchedItems.length : 0,
        method: "ai"
      });
    } catch (error) {
      console.error("Screenshot processing error:", error);
      res.status(500).json({ error: "Failed to process screenshot" });
    }
  });
  app.post("/api/portfolio/import/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { items } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "No items to import" });
      }
      const createdHoldings = [];
      for (const item of items) {
        const validatedHolding = insertPortfolioHoldingSchema.parse({
          itemId: item.itemId,
          itemName: item.itemName,
          itemIcon: item.itemIcon,
          quantity: item.quantity,
          avgBuyPrice: item.avgBuyPrice,
          categoryId: item.categoryId,
          source: "screenshot"
        });
        const holding = await storage.createPortfolioHolding(userId, validatedHolding);
        createdHoldings.push(holding);
      }
      res.status(201).json(createdHoldings);
    } catch (error) {
      res.status(400).json({ error: "Invalid import data" });
    }
  });
  app.get("/api/portfolio/snapshots", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit) : void 0;
      const snapshots = await storage.getPortfolioSnapshots(userId, limit);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch snapshots" });
    }
  });
  app.post("/api/portfolio/snapshots", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      if (holdings.length === 0) {
        return res.status(400).json({ error: "No holdings to snapshot" });
      }
      let totalValue = 0;
      let totalCost = 0;
      const snapshotItems = [];
      for (const holding of holdings) {
        let currentPrice = holding.lastValuedPrice || holding.avgBuyPrice;
        try {
          const priceData = await getItemPrice(holding.itemName);
          if (priceData) {
            currentPrice = priceData.price;
            await storage.updatePortfolioHolding(holding.id, userId, {
              lastValuedPrice: currentPrice,
              lastValuedAt: /* @__PURE__ */ new Date()
            });
          }
        } catch (e) {
          console.warn(`Failed to get price for ${holding.itemName}`);
        }
        const value = currentPrice * holding.quantity;
        const cost = holding.avgBuyPrice * holding.quantity;
        totalValue += value;
        totalCost += cost;
        snapshotItems.push({
          holdingId: holding.id,
          itemId: holding.itemId,
          itemName: holding.itemName,
          quantity: holding.quantity,
          avgBuyPrice: holding.avgBuyPrice,
          currentPrice,
          value,
          profit: value - cost,
          categoryId: holding.categoryId
        });
      }
      const snapshot = await storage.createPortfolioSnapshot(userId, {
        totalValue,
        totalCost,
        totalProfit: totalValue - totalCost,
        itemCount: holdings.length,
        snapshotDate: /* @__PURE__ */ new Date()
      });
      await storage.createSnapshotItems(snapshot.id, snapshotItems.map((item) => ({
        snapshotId: snapshot.id,
        ...item
      })));
      res.status(201).json({
        ...snapshot,
        items: snapshotItems
      });
    } catch (error) {
      console.error("Snapshot creation error:", error);
      res.status(500).json({ error: "Failed to create snapshot" });
    }
  });
  app.get("/api/portfolio/snapshots/:id/items", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getSnapshotItems(id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch snapshot items" });
    }
  });
  app.get("/api/portfolio/summary", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      const categories = await storage.getPortfolioCategories(userId);
      let totalValue = 0;
      let totalCost = 0;
      let totalRealizedProfit = 0;
      let totalRealizedLoss = 0;
      const holdingsWithValues = [];
      for (const holding of holdings) {
        const currentPrice = holding.lastValuedPrice || holding.avgBuyPrice;
        const value = currentPrice * holding.quantity;
        const cost = holding.avgBuyPrice * holding.quantity;
        totalValue += value;
        totalCost += cost;
        totalRealizedProfit += holding.realizedProfit || 0;
        totalRealizedLoss += holding.realizedLoss || 0;
      }
      for (const holding of holdings) {
        const currentPrice = holding.lastValuedPrice || holding.avgBuyPrice;
        const value = currentPrice * holding.quantity;
        const cost = holding.avgBuyPrice * holding.quantity;
        const allocation = totalValue > 0 ? value / totalValue * 100 : 0;
        holdingsWithValues.push({
          ...holding,
          currentPrice,
          value,
          profit: value - cost,
          profitPercent: cost > 0 ? (value - cost) / cost * 100 : 0,
          allocation
        });
      }
      const categoryBreakdown = categories.map((cat) => {
        const catHoldings = holdingsWithValues.filter((h) => h.categoryId === cat.id);
        const catValue = catHoldings.reduce((sum, h) => sum + h.value, 0);
        const catCost = catHoldings.reduce((sum, h) => sum + h.avgBuyPrice * h.quantity, 0);
        return {
          ...cat,
          holdingCount: catHoldings.length,
          totalValue: catValue,
          totalCost: catCost,
          totalProfit: catValue - catCost,
          profitPercent: catCost > 0 ? (catValue - catCost) / catCost * 100 : 0
        };
      });
      const uncategorized = holdingsWithValues.filter((h) => !h.categoryId);
      if (uncategorized.length > 0) {
        const uncatValue = uncategorized.reduce((sum, h) => sum + h.value, 0);
        const uncatCost = uncategorized.reduce((sum, h) => sum + h.avgBuyPrice * h.quantity, 0);
        categoryBreakdown.push({
          id: null,
          name: "Uncategorized",
          color: "#6b7280",
          holdingCount: uncategorized.length,
          totalValue: uncatValue,
          totalCost: uncatCost,
          totalProfit: uncatValue - uncatCost,
          profitPercent: uncatCost > 0 ? (uncatValue - uncatCost) / uncatCost * 100 : 0
        });
      }
      res.json({
        totalValue,
        totalCost,
        totalProfit: totalValue - totalCost,
        profitPercent: totalCost > 0 ? (totalValue - totalCost) / totalCost * 100 : 0,
        totalRealizedProfit,
        totalRealizedLoss,
        netRealizedProfit: totalRealizedProfit - totalRealizedLoss,
        holdingCount: holdings.length,
        holdings: holdingsWithValues,
        categories: categoryBreakdown
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio summary" });
    }
  });
  app.get("/api/analytics/volume/:itemId", isAuthenticated, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      const range = req.query.range || "week";
      const now = /* @__PURE__ */ new Date();
      let startDate;
      switch (range) {
        case "day":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1e3);
          break;
        case "month":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3);
          break;
        case "week":
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1e3);
      }
      const daily = await storage.getItemVolumeDaily(itemId, startDate, now);
      const weekly = await storage.getItemVolumeWeekly(itemId);
      const monthly = await storage.getItemVolumeMonthly(itemId);
      res.json({ daily, weekly, monthly });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch volume analytics" });
    }
  });
  app.get("/api/analytics/transactions/:itemId", isAuthenticated, async (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      const limit = parseInt(req.query.limit) || 100;
      const transactions = await storage.getTransactionsByItem(itemId, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  app.post("/api/heartbeat", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUserHeartbeat(userId);
      res.json({ status: "ok" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });
  app.get("/api/presence/online-count", isAuthenticated, async (req, res) => {
    try {
      const onlineUsers = await storage.getOnlineUsers(6e4);
      res.json({ onlineCount: onlineUsers.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch online count" });
    }
  });
  const isAdmin = async (req, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(403).json({ error: "User not found" });
      }
      if (!ADMIN_EMAILS.includes(user.email ?? "") && !user.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      next();
    } catch (error) {
      res.status(500).json({ error: "Failed to verify admin status" });
    }
  };
  app.get("/api/admin/check", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.json({ isAdmin: false });
      }
      const isAdminUser = ADMIN_EMAILS.includes(user.email ?? "") || user.isAdmin === true;
      res.json({ isAdmin: isAdminUser });
    } catch (error) {
      res.status(500).json({ error: "Failed to check admin status" });
    }
  });
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const sessions2 = await storage.getAllUserSessions();
      const onlineThreshold = 6e4;
      const now = Date.now();
      const usersWithStatus = allUsers.map((user) => {
        const session2 = sessions2.find((s) => s.userId === user.id);
        const isOnline = session2?.lastHeartbeat && now - new Date(session2.lastHeartbeat).getTime() < onlineThreshold;
        return {
          ...user,
          isOnline,
          lastHeartbeat: session2?.lastHeartbeat
        };
      });
      res.json(usersWithStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  app.get("/api/admin/presence", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const onlineUsers = await storage.getOnlineUsers(6e4);
      res.json({
        totalUsers: allUsers.length,
        onlineCount: onlineUsers.length,
        offlineCount: allUsers.length - onlineUsers.length,
        onlineUsers: onlineUsers.map((u) => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          profileImageUrl: u.profileImageUrl
        }))
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch presence data" });
    }
  });
  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const transactions = await storage.getAllTransactions(1e3);
      const totalTransactions = transactions.length;
      const buyTransactions = transactions.filter((t) => t.transactionType === "buy").length;
      const sellTransactions = transactions.filter((t) => t.transactionType === "sell").length;
      const totalVolume = transactions.reduce((sum, t) => sum + (t.totalValue || 0), 0);
      const totalTaxPaid = transactions.reduce((sum, t) => sum + (t.taxPaid || 0), 0);
      const uniqueItems = new Set(transactions.map((t) => t.itemId)).size;
      res.json({
        totalUsers: allUsers.length,
        totalTransactions,
        buyTransactions,
        sellTransactions,
        totalVolume,
        totalTaxPaid,
        uniqueItems
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch platform stats" });
    }
  });
  app.get("/api/admin/transactions", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 500;
      const transactions = await storage.getAllTransactions(limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });
  app.post("/api/flips/backfill-item-ids", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips2 = await storage.getFlips(userId);
      const flipsWithoutId = flips2.filter((f) => !f.itemId && f.itemName);
      let updated = 0;
      let failed = 0;
      const errors = [];
      const BATCH_SIZE = 5;
      const DELAY_MS = 500;
      for (let i = 0; i < flipsWithoutId.length; i += BATCH_SIZE) {
        const batch = flipsWithoutId.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (flip) => {
          try {
            const item = await getItemPrice(flip.itemName);
            if (item && item.id) {
              const updateData = { itemId: item.id };
              if (item.icon !== void 0 && item.icon !== null) {
                updateData.itemIcon = item.icon;
              }
              if (item.isMembers !== void 0 && item.isMembers !== null) {
                updateData.isMembers = item.isMembers;
              }
              if (item.geLimit !== void 0 && item.geLimit !== null) {
                updateData.geLimit = item.geLimit;
              }
              await storage.updateFlip(flip.id, userId, updateData);
              updated++;
            } else {
              failed++;
              errors.push(`Item not found: ${flip.itemName}`);
            }
          } catch (error) {
            console.error(`[backfill] Failed to lookup item: ${flip.itemName}`, error);
            failed++;
            errors.push(`Error for ${flip.itemName}: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }));
        if (i + BATCH_SIZE < flipsWithoutId.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
      }
      res.json({
        message: `Backfill complete`,
        total: flipsWithoutId.length,
        updated,
        failed,
        errors: errors.slice(0, 10)
        // Only return first 10 errors
      });
    } catch (error) {
      console.error("[backfill] Error:", error);
      res.status(500).json({ error: "Failed to backfill item IDs" });
    }
  });
  app.get("/api/ge/resolve-id", async (req, res) => {
    try {
      const { name } = req.query;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Item name required" });
      }
      const item = await getItemPrice(name);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json({ id: item.id, name: item.name });
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve item ID" });
    }
  });
  app.get("/api/rs-accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const accounts = await storage.getRsAccounts(userId);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch RS accounts" });
    }
  });
  app.post("/api/rs-accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedAccount = insertRsAccountSchema.parse(req.body);
      const existingAccounts = await storage.getRsAccounts(userId);
      if (existingAccounts.length === 0) {
        validatedAccount.isDefault = true;
      }
      const newAccount = await storage.createRsAccount(userId, validatedAccount);
      res.status(201).json(newAccount);
    } catch (error) {
      res.status(400).json({ error: "Invalid RS account data" });
    }
  });
  app.patch("/api/rs-accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const updates = insertRsAccountSchema.partial().parse(req.body);
      const updated = await storage.updateRsAccount(id, userId, updates);
      if (!updated) {
        return res.status(404).json({ error: "RS account not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid RS account data" });
    }
  });
  app.delete("/api/rs-accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deleteRsAccount(id, userId);
      if (!success) {
        return res.status(404).json({ error: "RS account not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete RS account" });
    }
  });
  app.post("/api/rs-accounts/:id/set-default", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const account = await storage.setDefaultRsAccount(id, userId);
      if (!account) {
        return res.status(404).json({ error: "RS account not found" });
      }
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to set default RS account" });
    }
  });
  app.patch("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName } = req.body;
      const updated = await storage.updateUserProfile(userId, { firstName, lastName });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
  app.post("/api/user/avatar", isAuthenticated, upload.single("avatar"), async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const mimeType = req.file.mimetype;
      const base64 = req.file.buffer.toString("base64");
      const profileImageUrl = `data:${mimeType};base64,${base64}`;
      const updated = await storage.updateUserProfile(userId, { profileImageUrl });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });
  app.get("/api/recipes", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes2 = await storage.getRecipes(userId);
      res.json(recipes2);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });
  app.get("/api/recipes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const recipe = await storage.getRecipeWithComponents(id);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe" });
    }
  });
  app.post("/api/recipes", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const { components, ...recipeData } = req.body;
      const validatedRecipe = insertRecipeSchema.parse(recipeData);
      const recipe = await storage.createRecipe(userId, validatedRecipe);
      if (components && Array.isArray(components)) {
        for (const comp of components) {
          const validatedComp = insertRecipeComponentSchema.parse({
            ...comp,
            recipeId: recipe.id
          });
          await storage.createRecipeComponent(validatedComp);
        }
      }
      const fullRecipe = await storage.getRecipeWithComponents(recipe.id);
      res.status(201).json(fullRecipe);
    } catch (error) {
      console.error("Error creating recipe:", error);
      res.status(400).json({ error: "Invalid recipe data" });
    }
  });
  app.patch("/api/recipes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const updates = insertRecipeSchema.partial().parse(req.body);
      const updated = await storage.updateRecipe(id, userId, updates);
      if (!updated) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid recipe data" });
    }
  });
  app.delete("/api/recipes/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deleteRecipe(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete recipe" });
    }
  });
  app.post("/api/recipes/:id/archive", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const archived = await storage.archiveRecipe(id, userId);
      if (!archived) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(archived);
    } catch (error) {
      res.status(500).json({ error: "Failed to archive recipe" });
    }
  });
  app.post("/api/recipes/:recipeId/components", isAuthenticated, async (req, res) => {
    try {
      const { recipeId } = req.params;
      const validatedComp = insertRecipeComponentSchema.parse({
        ...req.body,
        recipeId
      });
      const component = await storage.createRecipeComponent(validatedComp);
      res.status(201).json(component);
    } catch (error) {
      res.status(400).json({ error: "Invalid component data" });
    }
  });
  app.patch("/api/recipe-components/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertRecipeComponentSchema.partial().parse(req.body);
      const updated = await storage.updateRecipeComponent(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid component data" });
    }
  });
  app.delete("/api/recipe-components/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteRecipeComponent(id);
      if (!success) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete component" });
    }
  });
  app.get("/api/recipe-runs", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const runs = await storage.getRecipeRuns(userId);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe runs" });
    }
  });
  app.get("/api/recipe-runs/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const run = await storage.getRecipeRunWithDetails(id);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch run" });
    }
  });
  app.post("/api/recipe-runs", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedRun = insertRecipeRunSchema.parse(req.body);
      const run = await storage.createRecipeRun(userId, validatedRun);
      res.status(201).json(run);
    } catch (error) {
      console.error("Error creating run:", error);
      res.status(400).json({ error: "Invalid run data" });
    }
  });
  app.patch("/api/recipe-runs/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const updated = await storage.updateRecipeRun(id, userId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Run not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid run data" });
    }
  });
  app.delete("/api/recipe-runs/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const success = await storage.deleteRecipeRun(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Run not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete run" });
    }
  });
  app.post("/api/recipe-runs/:runId/components", isAuthenticated, async (req, res) => {
    try {
      const { runId } = req.params;
      const userId = req.user.claims.sub;
      const run = await storage.getRecipeRun(runId);
      if (!run || run.userId !== userId) {
        return res.status(404).json({ error: "Run not found" });
      }
      const validatedComp = insertRecipeRunComponentSchema.parse({
        ...req.body,
        runId,
        totalCost: req.body.buyPrice * req.body.quantityAcquired
      });
      const component = await storage.createRecipeRunComponent(validatedComp);
      const runComponents = await storage.getRecipeRunComponents(runId);
      const totalCost = runComponents.reduce((sum, c) => sum + c.totalCost, 0);
      await storage.updateRecipeRun(runId, userId, { totalComponentCost: totalCost });
      res.status(201).json(component);
    } catch (error) {
      console.error("Error logging component:", error);
      res.status(400).json({ error: "Invalid component data" });
    }
  });
  app.patch("/api/recipe-run-components/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertRecipeRunComponentSchema.partial().parse(req.body);
      const updated = await storage.updateRecipeRunComponent(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Invalid component data" });
    }
  });
  app.delete("/api/recipe-run-components/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteRecipeRunComponent(id);
      if (!success) {
        return res.status(404).json({ error: "Component not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete component" });
    }
  });
  app.post("/api/recipe-runs/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { sellPrice, sellDate } = req.body;
      const runDetails = await storage.getRecipeRunWithDetails(id);
      if (!runDetails || runDetails.userId !== userId) {
        return res.status(404).json({ error: "Run not found" });
      }
      const totalCost = runDetails.totalComponentCost || 0;
      const actualSellPrice = sellPrice || runDetails.targetSellPrice || 0;
      const taxDetails = calculateFlipTax(actualSellPrice, totalCost, runDetails.recipe.outputQuantity);
      const profit = taxDetails.profit;
      const flip = await storage.createFlip(userId, {
        itemName: runDetails.recipe.outputItemName,
        itemId: runDetails.recipe.outputItemId ?? void 0,
        itemIcon: runDetails.recipe.outputItemIcon ?? void 0,
        quantity: runDetails.recipe.outputQuantity,
        buyPrice: Math.floor(totalCost / runDetails.recipe.outputQuantity),
        // Average cost per item
        sellPrice: actualSellPrice,
        buyDate: runDetails.startedAt || /* @__PURE__ */ new Date(),
        sellDate: sellDate ? new Date(sellDate) : /* @__PURE__ */ new Date(),
        strategyTag: "Other",
        membershipStatus: "Unknown",
        tradeType: "ge",
        notes: `Crafted from recipe: ${runDetails.recipe.name}`,
        category: "Crafting"
      });
      await storage.updateRecipeRun(id, userId, {
        status: "sold",
        actualSellPrice,
        profit,
        linkedFlipId: flip.id,
        completedAt: /* @__PURE__ */ new Date()
      });
      const updatedRun = await storage.getRecipeRunWithDetails(id);
      res.json({ run: updatedRun, flip });
    } catch (error) {
      console.error("Error completing run:", error);
      res.status(500).json({ error: "Failed to complete run" });
    }
  });
  let marketMoversCache = null;
  let marketMoversCacheTime = 0;
  const MARKET_MOVERS_CACHE_TTL = 5 * 60 * 1e3;
  app.get("/api/market-movers", isAuthenticated, async (req, res) => {
    try {
      const now = Date.now();
      if (marketMoversCache && now - marketMoversCacheTime < MARKET_MOVERS_CACHE_TTL) {
        return res.json(marketMoversCache);
      }
      const dumpResponse = await fetch("https://chisel.weirdgloop.org/gazproj/gazbot/rs_dump.json", {
        headers: { "User-Agent": "RS3FlipTracker/1.0 (Replit App; contact@replit.com)" }
      });
      if (!dumpResponse.ok) {
        return res.status(502).json({ error: "Failed to fetch GE dump" });
      }
      const dump = await dumpResponse.json();
      const items = [];
      for (const [key, value] of Object.entries(dump)) {
        if (key.startsWith("%")) continue;
        const itemData = value;
        const id = parseInt(key);
        if (isNaN(id) || !itemData.name || !itemData.price || itemData.price < 100) continue;
        items.push({
          itemId: id,
          itemName: itemData.name,
          currentPrice: itemData.price,
          volume: itemData.volume || 0,
          members: !!itemData.members
        });
      }
      items.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      const topItems = items.slice(0, 100);
      const historyResults = await Promise.allSettled(
        topItems.map(async (item) => {
          const resp = await fetch(
            `https://api.weirdgloop.org/exchange/history/rs/last90d?id=${item.itemId}`,
            { headers: { "User-Agent": "RS3FlipTracker/1.0 (Replit App; contact@replit.com)" } }
          );
          if (!resp.ok) return { itemId: item.itemId, history: [] };
          const data = await resp.json();
          const history = data[item.itemId.toString()] || [];
          return { itemId: item.itemId, history };
        })
      );
      const historyMap = /* @__PURE__ */ new Map();
      for (const result2 of historyResults) {
        if (result2.status === "fulfilled") {
          historyMap.set(result2.value.itemId, result2.value.history);
        }
      }
      const movers = topItems.map((item) => {
        const rawHistory = historyMap.get(item.itemId) || [];
        const sortedHistory = [...rawHistory].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        let price24h = item.currentPrice;
        let price7d = item.currentPrice;
        if (sortedHistory.length > 0) {
          const nowMs = Date.now();
          const day1Ago = nowMs - 864e5;
          const day7Ago = nowMs - 7 * 864e5;
          let closest24h = Infinity;
          let closest7d = Infinity;
          for (const entry of sortedHistory) {
            const ts = new Date(entry.timestamp).getTime();
            const price = entry.price;
            if (!ts || !price) continue;
            const diff24h = Math.abs(ts - day1Ago);
            if (diff24h < closest24h) {
              closest24h = diff24h;
              price24h = price;
            }
            const diff7d = Math.abs(ts - day7Ago);
            if (diff7d < closest7d) {
              closest7d = diff7d;
              price7d = price;
            }
          }
        }
        const change24h = item.currentPrice - price24h;
        const change7d = item.currentPrice - price7d;
        return {
          ...item,
          price24hAgo: price24h,
          price7dAgo: price7d,
          change24h,
          change7d,
          changePercent24h: price24h > 0 ? change24h / price24h * 100 : 0,
          changePercent7d: price7d > 0 ? change7d / price7d * 100 : 0
        };
      });
      const gainers = [...movers].filter((m) => m.changePercent24h > 0).sort((a, b) => b.changePercent24h - a.changePercent24h).slice(0, 20);
      const losers = [...movers].filter((m) => m.changePercent24h < 0).sort((a, b) => a.changePercent24h - b.changePercent24h).slice(0, 20);
      const mostActive = [...movers].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 20);
      const result = { gainers, losers, mostActive, timestamp: Date.now() };
      marketMoversCache = result;
      marketMoversCacheTime = now;
      res.json(result);
    } catch (error) {
      console.error("Market movers error:", error);
      res.status(500).json({ error: "Failed to fetch market movers" });
    }
  });
  app.post("/api/discord/daily-summary", isAuthenticated, async (req, res) => {
    const userId = req.user.claims.sub;
    const result = await sendDailySummaryToDiscord(userId, storage);
    res.json({ success: result });
  });
  app.get("/api/discord/status", isAuthenticated, async (req, res) => {
    res.json({ configured: !!process.env.DISCORD_WEBHOOK_URL });
  });
  const httpServer = createServer(app);
  return httpServer;
}

// server/log.ts
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// server/app.ts
async function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
        if (logLine.length > 80) {
          logLine = logLine.slice(0, 79) + "...";
        }
        log(logLine);
      }
    });
    next();
  });
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  return { app, server };
}

// server/vercel.ts
var appPromise;
async function getApp() {
  if (!appPromise) {
    appPromise = createApp().then(({ app }) => app);
  }
  return appPromise;
}
async function handler(req, res) {
  const app = await getApp();
  return app(req, res);
}
export {
  handler as default
};
