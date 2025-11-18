import { users, flips, type User, type InsertUser, type Flip, type InsertFlip } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createFlip(flip: InsertFlip): Promise<Flip>;
  getFlips(): Promise<Flip[]>;
  getFlip(id: string): Promise<Flip | undefined>;
  updateFlip(id: string, flip: Partial<InsertFlip>): Promise<Flip | undefined>;
  deleteFlip(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createFlip(flip: InsertFlip): Promise<Flip> {
    const [newFlip] = await db
      .insert(flips)
      .values(flip)
      .returning();
    return newFlip;
  }

  async getFlips(): Promise<Flip[]> {
    return await db.select().from(flips).orderBy(desc(flips.buyDate));
  }

  async getFlip(id: string): Promise<Flip | undefined> {
    const [flip] = await db.select().from(flips).where(eq(flips.id, id));
    return flip || undefined;
  }

  async updateFlip(id: string, flipUpdate: Partial<InsertFlip>): Promise<Flip | undefined> {
    const [updatedFlip] = await db
      .update(flips)
      .set(flipUpdate)
      .where(eq(flips.id, id))
      .returning();
    return updatedFlip || undefined;
  }

  async deleteFlip(id: string): Promise<boolean> {
    const result = await db.delete(flips).where(eq(flips.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
