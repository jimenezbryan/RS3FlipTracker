import { users, flips, watchlist, priceAlerts, type User, type UpsertUser, type Flip, type InsertFlip, type WatchlistItem, type InsertWatchlistItem, type PriceAlert, type InsertPriceAlert } from "@shared/schema";
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
  
  createWatchlistItem(userId: string, item: InsertWatchlistItem): Promise<WatchlistItem>;
  getWatchlist(userId: string): Promise<WatchlistItem[]>;
  getWatchlistItem(id: string): Promise<WatchlistItem | undefined>;
  updateWatchlistItem(id: string, userId: string, item: Partial<InsertWatchlistItem>): Promise<WatchlistItem | undefined>;
  deleteWatchlistItem(id: string, userId: string): Promise<boolean>;
  
  createPriceAlert(userId: string, alert: InsertPriceAlert): Promise<PriceAlert>;
  getPriceAlerts(userId: string): Promise<PriceAlert[]>;
  getPriceAlert(id: string): Promise<PriceAlert | undefined>;
  updatePriceAlert(id: string, userId: string, alert: Partial<InsertPriceAlert & { isActive?: number, triggeredAt?: Date }>): Promise<PriceAlert | undefined>;
  deletePriceAlert(id: string, userId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private flips: Map<string, Flip> = new Map();
  private watchlistItems: Map<string, WatchlistItem> = new Map();
  private alerts: Map<string, PriceAlert> = new Map();

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

  async createWatchlistItem(userId: string, item: InsertWatchlistItem): Promise<WatchlistItem> {
    const id = randomUUID();
    const newItem: WatchlistItem = {
      id,
      userId,
      itemId: item.itemId,
      itemName: item.itemName,
      itemIcon: item.itemIcon ?? null,
      targetBuyPrice: item.targetBuyPrice ?? null,
      targetSellPrice: item.targetSellPrice ?? null,
      notes: item.notes ?? null,
      createdAt: new Date(),
    };
    this.watchlistItems.set(id, newItem);
    return newItem;
  }

  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return Array.from(this.watchlistItems.values())
      .filter(w => w.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getWatchlistItem(id: string): Promise<WatchlistItem | undefined> {
    return this.watchlistItems.get(id);
  }

  async updateWatchlistItem(id: string, userId: string, item: Partial<InsertWatchlistItem>): Promise<WatchlistItem | undefined> {
    const existing = this.watchlistItems.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: WatchlistItem = { ...existing, ...item };
    this.watchlistItems.set(id, updated);
    return updated;
  }

  async deleteWatchlistItem(id: string, userId: string): Promise<boolean> {
    const existing = this.watchlistItems.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.watchlistItems.delete(id);
  }

  async createPriceAlert(userId: string, alert: InsertPriceAlert): Promise<PriceAlert> {
    const id = randomUUID();
    const newAlert: PriceAlert = {
      id,
      userId,
      itemId: alert.itemId,
      itemName: alert.itemName,
      itemIcon: alert.itemIcon ?? null,
      alertType: alert.alertType,
      targetPrice: alert.targetPrice,
      isActive: 1,
      triggeredAt: null,
      createdAt: new Date(),
    };
    this.alerts.set(id, newAlert);
    return newAlert;
  }

  async getPriceAlerts(userId: string): Promise<PriceAlert[]> {
    return Array.from(this.alerts.values())
      .filter(a => a.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getPriceAlert(id: string): Promise<PriceAlert | undefined> {
    return this.alerts.get(id);
  }

  async updatePriceAlert(id: string, userId: string, alert: Partial<InsertPriceAlert & { isActive?: number, triggeredAt?: Date }>): Promise<PriceAlert | undefined> {
    const existing = this.alerts.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: PriceAlert = { ...existing, ...alert };
    this.alerts.set(id, updated);
    return updated;
  }

  async deletePriceAlert(id: string, userId: string): Promise<boolean> {
    const existing = this.alerts.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.alerts.delete(id);
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

  async createWatchlistItem(userId: string, item: InsertWatchlistItem): Promise<WatchlistItem> {
    const [newItem] = await db
      .insert(watchlist)
      .values({ ...item, userId })
      .returning();
    return newItem;
  }

  async getWatchlist(userId: string): Promise<WatchlistItem[]> {
    return await db.select().from(watchlist).where(eq(watchlist.userId, userId)).orderBy(desc(watchlist.createdAt));
  }

  async getWatchlistItem(id: string): Promise<WatchlistItem | undefined> {
    const [item] = await db.select().from(watchlist).where(eq(watchlist.id, id));
    return item || undefined;
  }

  async updateWatchlistItem(id: string, userId: string, item: Partial<InsertWatchlistItem>): Promise<WatchlistItem | undefined> {
    const [updatedItem] = await db
      .update(watchlist)
      .set(item)
      .where(and(eq(watchlist.id, id), eq(watchlist.userId, userId)))
      .returning();
    return updatedItem || undefined;
  }

  async deleteWatchlistItem(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(watchlist).where(and(eq(watchlist.id, id), eq(watchlist.userId, userId))).returning();
    return result.length > 0;
  }

  async createPriceAlert(userId: string, alert: InsertPriceAlert): Promise<PriceAlert> {
    const [newAlert] = await db
      .insert(priceAlerts)
      .values({ ...alert, userId })
      .returning();
    return newAlert;
  }

  async getPriceAlerts(userId: string): Promise<PriceAlert[]> {
    return await db.select().from(priceAlerts).where(eq(priceAlerts.userId, userId)).orderBy(desc(priceAlerts.createdAt));
  }

  async getPriceAlert(id: string): Promise<PriceAlert | undefined> {
    const [alert] = await db.select().from(priceAlerts).where(eq(priceAlerts.id, id));
    return alert || undefined;
  }

  async updatePriceAlert(id: string, userId: string, alert: Partial<InsertPriceAlert & { isActive?: number, triggeredAt?: Date }>): Promise<PriceAlert | undefined> {
    const [updatedAlert] = await db
      .update(priceAlerts)
      .set(alert)
      .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId)))
      .returning();
    return updatedAlert || undefined;
  }

  async deletePriceAlert(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(priceAlerts).where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, userId))).returning();
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
