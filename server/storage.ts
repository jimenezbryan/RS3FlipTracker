import { users, flips, type User, type InsertUser, type Flip, type InsertFlip } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

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

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private flips: Map<string, Flip> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { id, ...insertUser };
    this.users.set(id, user);
    return user;
  }

  async createFlip(flip: InsertFlip): Promise<Flip> {
    const id = randomUUID();
    const newFlip: Flip = {
      id,
      itemName: flip.itemName,
      itemIcon: flip.itemIcon ?? null,
      quantity: flip.quantity ?? 1,
      buyPrice: flip.buyPrice,
      sellPrice: flip.sellPrice ?? null,
      buyDate: flip.buyDate,
      sellDate: flip.sellDate ?? null,
    };
    this.flips.set(id, newFlip);
    return newFlip;
  }

  async getFlips(): Promise<Flip[]> {
    return Array.from(this.flips.values()).sort((a, b) => 
      new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime()
    );
  }

  async getFlip(id: string): Promise<Flip | undefined> {
    return this.flips.get(id);
  }

  async updateFlip(id: string, flipUpdate: Partial<InsertFlip>): Promise<Flip | undefined> {
    const existing = this.flips.get(id);
    if (!existing) return undefined;
    
    const updated: Flip = {
      ...existing,
      ...flipUpdate,
      sellPrice: flipUpdate.sellPrice ?? existing.sellPrice,
      sellDate: flipUpdate.sellDate ?? existing.sellDate,
    };
    this.flips.set(id, updated);
    return updated;
  }

  async deleteFlip(id: string): Promise<boolean> {
    return this.flips.delete(id);
  }
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

async function createStorage(): Promise<IStorage> {
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

export let storage: IStorage = new MemStorage();

createStorage().then((s) => {
  storage = s;
});
