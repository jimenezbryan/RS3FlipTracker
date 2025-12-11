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
  quantity: integer("quantity").notNull().default(1),
  buyPrice: integer("buy_price").notNull(),
  sellPrice: integer("sell_price"),
  buyDate: timestamp("buy_date").notNull(),
  sellDate: timestamp("sell_date"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export const insertFlipSchema = createInsertSchema(flips).omit({
  id: true,
}).extend({
  quantity: z.coerce.number().int().positive().default(1),
  buyPrice: z.coerce.number().int().positive(),
  sellPrice: z.coerce.number().int().positive().optional(),
  buyDate: z.coerce.date(),
  sellDate: z.coerce.date().optional(),
});

export type InsertFlip = z.infer<typeof insertFlipSchema>;
export type Flip = typeof flips.$inferSelect;
