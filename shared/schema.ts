import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const flips = pgTable("flips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemName: text("item_name").notNull(),
  itemIcon: text("item_icon"),
  quantity: integer("quantity").notNull().default(1),
  buyPrice: integer("buy_price").notNull(),
  sellPrice: integer("sell_price"),
  buyDate: timestamp("buy_date").notNull(),
  sellDate: timestamp("sell_date"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertFlipSchema = createInsertSchema(flips).omit({
  id: true,
}).extend({
  quantity: z.number().int().positive().default(1),
  buyPrice: z.number().int().positive(),
  sellPrice: z.number().int().positive().optional(),
  buyDate: z.coerce.date(),
  sellDate: z.coerce.date().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertFlip = z.infer<typeof insertFlipSchema>;
export type Flip = typeof flips.$inferSelect;
