import { users, flips, type User, type UpsertUser, type Flip, type InsertFlip } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  createFlip(userId: string, flip: InsertFlip): Promise<Flip>;
  getFlips(userId: string): Promise<Flip[]>;
  getFlip(id: string): Promise<Flip | undefined>;
  updateFlip(id: string, userId: string, flip: Partial<InsertFlip>): Promise<Flip | undefined>;
  deleteFlip(id: string, userId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private flips: Map<string, Flip> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = userData.id ? this.users.get(userData.id) : undefined;
    if (existing) {
      const updated: User = {
        ...existing,
        ...userData,
        updatedAt: new Date(),
      };
      this.users.set(existing.id, updated);
      return updated;
    }
    const id = userData.id || randomUUID();
    const user: User = {
      id,
      email: userData.email ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async createFlip(userId: string, flip: InsertFlip): Promise<Flip> {
    const id = randomUUID();
    const newFlip: Flip = {
      id,
      userId,
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

  async getFlips(userId: string): Promise<Flip[]> {
    return Array.from(this.flips.values())
      .filter(f => f.userId === userId)
      .sort((a, b) => new Date(b.buyDate).getTime() - new Date(a.buyDate).getTime());
  }

  async getFlip(id: string): Promise<Flip | undefined> {
    return this.flips.get(id);
  }

  async updateFlip(id: string, userId: string, flipUpdate: Partial<InsertFlip>): Promise<Flip | undefined> {
    const existing = this.flips.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    
    const updated: Flip = {
      ...existing,
      ...flipUpdate,
      sellPrice: flipUpdate.sellPrice ?? existing.sellPrice,
      sellDate: flipUpdate.sellDate ?? existing.sellDate,
    };
    this.flips.set(id, updated);
    return updated;
  }

  async deleteFlip(id: string, userId: string): Promise<boolean> {
    const existing = this.flips.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.flips.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createFlip(userId: string, flip: InsertFlip): Promise<Flip> {
    const [newFlip] = await db
      .insert(flips)
      .values({ ...flip, userId })
      .returning();
    return newFlip;
  }

  async getFlips(userId: string): Promise<Flip[]> {
    return await db.select().from(flips).where(eq(flips.userId, userId)).orderBy(desc(flips.buyDate));
  }

  async getFlip(id: string): Promise<Flip | undefined> {
    const [flip] = await db.select().from(flips).where(eq(flips.id, id));
    return flip || undefined;
  }

  async updateFlip(id: string, userId: string, flipUpdate: Partial<InsertFlip>): Promise<Flip | undefined> {
    const [updatedFlip] = await db
      .update(flips)
      .set(flipUpdate)
      .where(and(eq(flips.id, id), eq(flips.userId, userId)))
      .returning();
    return updatedFlip || undefined;
  }

  async deleteFlip(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(flips).where(and(eq(flips.id, id), eq(flips.userId, userId))).returning();
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
