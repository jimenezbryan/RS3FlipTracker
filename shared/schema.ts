import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, index, jsonb, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const membershipStatusEnum = pgEnum("membership_status", ["F2P", "Members", "Unknown"]);
export const rsAccountTypeEnum = pgEnum("rs_account_type", ["Main", "Ironman", "HCIM", "Ultimate", "GIM", "Alt", "Other"]);

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
  isAdmin: boolean("is_admin").default(false),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RS Accounts - for tracking multiple RuneScape accounts (alts)
export const rsAccounts = pgTable("rs_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  displayName: varchar("display_name", { length: 12 }).notNull(), // RSN max 12 chars
  accountType: rsAccountTypeEnum("account_type").default("Main"),
  isDefault: boolean("is_default").default(false),
  preferredWorld: integer("preferred_world"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRsAccountSchema = createInsertSchema(rsAccounts).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  displayName: z.string().min(1).max(12),
  accountType: z.enum(["Main", "Ironman", "HCIM", "Ultimate", "GIM", "Alt", "Other"]).default("Main"),
  isDefault: z.boolean().optional(),
  preferredWorld: z.coerce.number().int().positive().optional(),
  notes: z.string().optional(),
});

export type InsertRsAccount = z.infer<typeof insertRsAccountSchema>;
export type RsAccount = typeof rsAccounts.$inferSelect;

export const flips = pgTable("flips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  rsAccountId: varchar("rs_account_id").references(() => rsAccounts.id),
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
  membershipStatus: membershipStatusEnum("membership_status").default("Unknown"),
  isMembers: boolean("is_members"),
  geLimit: integer("ge_limit"),
  deletedAt: timestamp("deleted_at"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertFlipSchema = createInsertSchema(flips).omit({
  id: true,
  userId: true,
  deletedAt: true,
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
});

export type InsertFlip = z.infer<typeof insertFlipSchema>;
export type Flip = typeof flips.$inferSelect;

export type FlipWithUser = Flip & {
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
};

// Watchlist table for tracking items without logging flips
export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  targetBuyPrice: integer("target_buy_price"),
  targetSellPrice: integer("target_sell_price"),
  membershipStatus: membershipStatusEnum("membership_status").default("Unknown"),
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
  membershipStatus: z.enum(["F2P", "Members", "Unknown"]).default("Unknown"),
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
  membershipStatus: membershipStatusEnum("membership_status").default("Unknown"),
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
  membershipStatus: z.enum(["F2P", "Members", "Unknown"]).default("Unknown"),
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
  totalCost: integer("total_cost").notNull().default(0), // total invested
  realizedProfit: integer("realized_profit").notNull().default(0), // profit from completed sales
  realizedLoss: integer("realized_loss").notNull().default(0), // loss from completed sales
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
  totalCost: true,
  realizedProfit: true,
  realizedLoss: true,
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

export const updatePortfolioHoldingSchema = z.object({
  quantity: z.coerce.number().int().positive().optional(),
  avgBuyPrice: z.coerce.number().int().positive().optional(),
  categoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InsertPortfolioHolding = z.infer<typeof insertPortfolioHoldingSchema>;
export type UpdatePortfolioHolding = z.infer<typeof updatePortfolioHoldingSchema>;
export type PortfolioHolding = typeof portfolioHoldings.$inferSelect;

// Portfolio holding transactions - track buy/sell history per holding
export const portfolioHoldingTransactions = pgTable("portfolio_holding_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  holdingId: varchar("holding_id").notNull().references(() => portfolioHoldings.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionType: varchar("transaction_type", { length: 10 }).notNull(), // 'buy' or 'sell'
  quantity: integer("quantity").notNull(),
  pricePerUnit: integer("price_per_unit").notNull(),
  totalValue: integer("total_value").notNull(),
  fees: integer("fees").default(0), // GE tax for sells
  profitLoss: integer("profit_loss"), // calculated on sell: (sellPrice - avgBuyPrice) * quantity - fees
  notes: text("notes"),
  transactionDate: timestamp("transaction_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertHoldingTransactionSchema = createInsertSchema(portfolioHoldingTransactions).omit({
  id: true,
  userId: true,
  totalValue: true,
  profitLoss: true,
  createdAt: true,
}).extend({
  holdingId: z.string(),
  transactionType: z.enum(["buy", "sell"]),
  quantity: z.coerce.number().int().positive(),
  pricePerUnit: z.coerce.number().int().positive(),
  fees: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
  transactionDate: z.coerce.date(),
});

export type InsertHoldingTransaction = z.infer<typeof insertHoldingTransactionSchema>;
export type HoldingTransaction = typeof portfolioHoldingTransactions.$inferSelect;

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

// Flip transactions - Records each transaction event for analytics and LLM training
export const flipTransactions = pgTable("flip_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  flipId: varchar("flip_id").references(() => flips.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  transactionType: varchar("transaction_type", { length: 10 }).notNull(), // 'buy' or 'sell'
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull(),
  totalValue: integer("total_value").notNull(),
  taxPaid: integer("tax_paid").default(0), // Only for sell transactions
  strategyTag: varchar("strategy_tag", { length: 50 }),
  transactionDate: timestamp("transaction_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type FlipTransaction = typeof flipTransactions.$inferSelect;

// Item volume metrics - Daily aggregated volume data per item
export const itemVolumeDaily = pgTable("item_volume_daily", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  date: timestamp("date").notNull(),
  transactionCount: integer("transaction_count").notNull().default(0),
  totalQuantity: integer("total_quantity").notNull().default(0),
  totalValue: integer("total_value").notNull().default(0),
  avgPrice: integer("avg_price").default(0),
  minPrice: integer("min_price"),
  maxPrice: integer("max_price"),
  buyCount: integer("buy_count").default(0),
  sellCount: integer("sell_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ItemVolumeDaily = typeof itemVolumeDaily.$inferSelect;

// User sessions for presence tracking
export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  lastHeartbeat: timestamp("last_heartbeat").notNull(),
  status: varchar("status", { length: 10 }).notNull().default("online"), // 'online' or 'offline'
  createdAt: timestamp("created_at").defaultNow(),
});

export type UserSession = typeof userSessions.$inferSelect;

// Recipe run status enum
export const recipeRunStatusEnum = pgEnum("recipe_run_status", ["gathering", "ready", "crafted", "sold", "cancelled"]);

// Recipes - Template definitions for craftable items (e.g., ECB, SGB)
export const recipes = pgTable("recipes", {
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
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  userId: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(1).max(100),
  outputItemId: z.coerce.number().int().positive().optional(),
  outputItemName: z.string().min(1),
  outputItemIcon: z.string().optional(),
  outputQuantity: z.coerce.number().int().positive().default(1),
  notes: z.string().optional(),
});

export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

// Recipe Components - Items needed to craft a recipe
export const recipeComponents = pgTable("recipe_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  itemId: integer("item_id"),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  quantityRequired: integer("quantity_required").notNull().default(1),
  notes: text("notes"),
});

export const insertRecipeComponentSchema = createInsertSchema(recipeComponents).omit({
  id: true,
}).extend({
  recipeId: z.string(),
  itemId: z.coerce.number().int().positive().optional(),
  itemName: z.string().min(1),
  itemIcon: z.string().optional(),
  quantityRequired: z.coerce.number().int().positive().default(1),
  notes: z.string().optional(),
});

export type InsertRecipeComponent = z.infer<typeof insertRecipeComponentSchema>;
export type RecipeComponent = typeof recipeComponents.$inferSelect;

// Recipe Runs - Active crafting attempts
export const recipeRuns = pgTable("recipe_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  status: recipeRunStatusEnum("status").notNull().default("gathering"),
  targetSellPrice: integer("target_sell_price"),
  actualSellPrice: integer("actual_sell_price"),
  totalComponentCost: integer("total_component_cost").default(0),
  profit: integer("profit"),
  linkedFlipId: varchar("linked_flip_id").references(() => flips.id),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
});

export const insertRecipeRunSchema = createInsertSchema(recipeRuns).omit({
  id: true,
  userId: true,
  status: true,
  totalComponentCost: true,
  profit: true,
  linkedFlipId: true,
  startedAt: true,
  completedAt: true,
}).extend({
  recipeId: z.string(),
  targetSellPrice: z.coerce.number().int().positive().optional(),
  actualSellPrice: z.coerce.number().int().positive().optional(),
  notes: z.string().optional(),
});

export type InsertRecipeRun = z.infer<typeof insertRecipeRunSchema>;
export type RecipeRun = typeof recipeRuns.$inferSelect;

// Recipe Run Components - Individual component purchases for a run
export const recipeRunComponents = pgTable("recipe_run_components", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id").notNull().references(() => recipeRuns.id),
  componentId: varchar("component_id").notNull().references(() => recipeComponents.id),
  rsAccountId: varchar("rs_account_id").references(() => rsAccounts.id),
  quantityAcquired: integer("quantity_acquired").notNull().default(0),
  buyPrice: integer("buy_price").notNull(),
  totalCost: integer("total_cost").notNull(),
  purchaseDate: timestamp("purchase_date").defaultNow(),
  notes: text("notes"),
});

export const insertRecipeRunComponentSchema = createInsertSchema(recipeRunComponents).omit({
  id: true,
  purchaseDate: true,
}).extend({
  runId: z.string(),
  componentId: z.string(),
  rsAccountId: z.string().optional(),
  quantityAcquired: z.coerce.number().int().positive(),
  buyPrice: z.coerce.number().int().positive(),
  totalCost: z.coerce.number().int().positive(),
  notes: z.string().optional(),
});

export type InsertRecipeRunComponent = z.infer<typeof insertRecipeRunComponentSchema>;
export type RecipeRunComponent = typeof recipeRunComponents.$inferSelect;

// Extended types for recipes with components
export type RecipeWithComponents = Recipe & {
  components: RecipeComponent[];
};

export type RecipeRunWithDetails = RecipeRun & {
  recipe: Recipe;
  components: (RecipeRunComponent & {
    component: RecipeComponent;
    rsAccount?: RsAccount | null;
  })[];
};
