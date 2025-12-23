import { users, flips, watchlist, priceAlerts, favorites, profitGoals, portfolioCategories, portfolioHoldings, portfolioSnapshots, portfolioSnapshotItems, flipTransactions, itemVolumeDaily, userSessions, type User, type UpsertUser, type Flip, type InsertFlip, type WatchlistItem, type InsertWatchlistItem, type PriceAlert, type InsertPriceAlert, type Favorite, type InsertFavorite, type ProfitGoal, type InsertProfitGoal, type PortfolioCategory, type InsertPortfolioCategory, type PortfolioHolding, type InsertPortfolioHolding, type PortfolioSnapshot, type PortfolioSnapshotItem, type FlipTransaction, type ItemVolumeDaily, type UserSession } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, sql, gte, lte } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  createFlip(userId: string, flip: InsertFlip): Promise<Flip>;
  getFlips(userId: string): Promise<Flip[]>;
  getFlip(id: string): Promise<Flip | undefined>;
  updateFlip(id: string, userId: string, flip: Partial<InsertFlip>): Promise<Flip | undefined>;
  deleteFlip(id: string, userId: string): Promise<boolean>;
  softDeleteFlip(id: string, userId: string): Promise<Flip | undefined>;
  restoreFlip(id: string, userId: string): Promise<Flip | undefined>;
  
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
  
  createFavorite(userId: string, favorite: InsertFavorite): Promise<Favorite>;
  getFavorites(userId: string): Promise<Favorite[]>;
  deleteFavorite(id: string, userId: string): Promise<boolean>;
  
  createProfitGoal(userId: string, goal: InsertProfitGoal): Promise<ProfitGoal>;
  getProfitGoals(userId: string): Promise<ProfitGoal[]>;
  updateProfitGoal(id: string, userId: string, goal: Partial<InsertProfitGoal>): Promise<ProfitGoal | undefined>;
  deleteProfitGoal(id: string, userId: string): Promise<boolean>;
  
  // Portfolio Categories
  createPortfolioCategory(userId: string, category: InsertPortfolioCategory): Promise<PortfolioCategory>;
  getPortfolioCategories(userId: string): Promise<PortfolioCategory[]>;
  updatePortfolioCategory(id: string, userId: string, category: Partial<InsertPortfolioCategory>): Promise<PortfolioCategory | undefined>;
  deletePortfolioCategory(id: string, userId: string): Promise<boolean>;
  
  // Portfolio Holdings
  createPortfolioHolding(userId: string, holding: InsertPortfolioHolding): Promise<PortfolioHolding>;
  getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]>;
  getPortfolioHolding(id: string): Promise<PortfolioHolding | undefined>;
  updatePortfolioHolding(id: string, userId: string, holding: Partial<InsertPortfolioHolding & { lastValuedPrice?: number, lastValuedAt?: Date }>): Promise<PortfolioHolding | undefined>;
  deletePortfolioHolding(id: string, userId: string): Promise<boolean>;
  
  // Portfolio Snapshots
  createPortfolioSnapshot(userId: string, snapshot: { totalValue: number; totalCost: number; totalProfit: number; itemCount: number; snapshotDate: Date }): Promise<PortfolioSnapshot>;
  getPortfolioSnapshots(userId: string, limit?: number): Promise<PortfolioSnapshot[]>;
  createSnapshotItems(snapshotId: string, items: Omit<PortfolioSnapshotItem, 'id'>[]): Promise<void>;
  getSnapshotItems(snapshotId: string): Promise<PortfolioSnapshotItem[]>;
  
  // Transaction Recording (for LLM training)
  recordTransaction(tx: {
    flipId?: string;
    userId: string;
    itemId: number;
    itemName: string;
    transactionType: 'buy' | 'sell';
    price: number;
    quantity: number;
    taxPaid?: number;
    strategyTag?: string;
    transactionDate: Date;
  }): Promise<FlipTransaction>;
  getTransactionsByItem(itemId: number, limit?: number): Promise<FlipTransaction[]>;
  getAllTransactions(limit?: number): Promise<FlipTransaction[]>;
  
  // Volume Metrics
  updateItemVolume(itemId: number, itemName: string, date: Date, txType: 'buy' | 'sell', price: number, quantity: number): Promise<void>;
  getItemVolumeDaily(itemId: number, startDate: Date, endDate: Date): Promise<ItemVolumeDaily[]>;
  getItemVolumeWeekly(itemId: number): Promise<{ week: string; transactionCount: number; totalQuantity: number; totalValue: number }[]>;
  getItemVolumeMonthly(itemId: number): Promise<{ month: string; transactionCount: number; totalQuantity: number; totalValue: number }[]>;
  
  // User Presence & Admin
  updateUserHeartbeat(userId: string): Promise<void>;
  updateUserLastSeen(userId: string): Promise<void>;
  getUserSession(userId: string): Promise<UserSession | undefined>;
  getAllUserSessions(): Promise<UserSession[]>;
  getOnlineUsers(thresholdMs?: number): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  setUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private flips: Map<string, Flip> = new Map();
  private watchlistItems: Map<string, WatchlistItem> = new Map();
  private alerts: Map<string, PriceAlert> = new Map();
  private favoriteItems: Map<string, Favorite> = new Map();
  private goals: Map<string, ProfitGoal> = new Map();
  private portfolioCats: Map<string, PortfolioCategory> = new Map();
  private portfolioHolds: Map<string, PortfolioHolding> = new Map();
  private portfolioSnaps: Map<string, PortfolioSnapshot> = new Map();
  private portfolioSnapItems: Map<string, PortfolioSnapshotItem> = new Map();

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
      itemId: flip.itemId ?? null,
      quantity: flip.quantity ?? 1,
      buyPrice: flip.buyPrice,
      sellPrice: flip.sellPrice ?? null,
      buyDate: flip.buyDate,
      sellDate: flip.sellDate ?? null,
      notes: flip.notes ?? null,
      category: flip.category ?? null,
      deletedAt: null,
    };
    this.flips.set(id, newFlip);
    return newFlip;
  }

  async getFlips(userId: string): Promise<Flip[]> {
    return Array.from(this.flips.values())
      .filter(f => f.userId === userId && f.deletedAt === null)
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

  async softDeleteFlip(id: string, userId: string): Promise<Flip | undefined> {
    const existing = this.flips.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: Flip = { ...existing, deletedAt: new Date() };
    this.flips.set(id, updated);
    return updated;
  }

  async restoreFlip(id: string, userId: string): Promise<Flip | undefined> {
    const existing = this.flips.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: Flip = { ...existing, deletedAt: null };
    this.flips.set(id, updated);
    return updated;
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

  async createFavorite(userId: string, favorite: InsertFavorite): Promise<Favorite> {
    const id = randomUUID();
    const newFavorite: Favorite = {
      id,
      userId,
      itemId: favorite.itemId,
      itemName: favorite.itemName,
      itemIcon: favorite.itemIcon ?? null,
      createdAt: new Date(),
    };
    this.favoriteItems.set(id, newFavorite);
    return newFavorite;
  }

  async getFavorites(userId: string): Promise<Favorite[]> {
    return Array.from(this.favoriteItems.values())
      .filter(f => f.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async deleteFavorite(id: string, userId: string): Promise<boolean> {
    const existing = this.favoriteItems.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.favoriteItems.delete(id);
  }

  async createProfitGoal(userId: string, goal: InsertProfitGoal): Promise<ProfitGoal> {
    const id = randomUUID();
    const newGoal: ProfitGoal = {
      id,
      userId,
      goalType: goal.goalType,
      targetAmount: goal.targetAmount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.goals.set(id, newGoal);
    return newGoal;
  }

  async getProfitGoals(userId: string): Promise<ProfitGoal[]> {
    return Array.from(this.goals.values())
      .filter(g => g.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async updateProfitGoal(id: string, userId: string, goal: Partial<InsertProfitGoal>): Promise<ProfitGoal | undefined> {
    const existing = this.goals.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: ProfitGoal = { ...existing, ...goal, updatedAt: new Date() };
    this.goals.set(id, updated);
    return updated;
  }

  async deleteProfitGoal(id: string, userId: string): Promise<boolean> {
    const existing = this.goals.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.goals.delete(id);
  }

  // Portfolio Categories
  async createPortfolioCategory(userId: string, category: InsertPortfolioCategory): Promise<PortfolioCategory> {
    const id = randomUUID();
    const newCat: PortfolioCategory = {
      id,
      userId,
      name: category.name,
      color: category.color ?? "#6366f1",
      createdAt: new Date(),
    };
    this.portfolioCats.set(id, newCat);
    return newCat;
  }

  async getPortfolioCategories(userId: string): Promise<PortfolioCategory[]> {
    return Array.from(this.portfolioCats.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  async updatePortfolioCategory(id: string, userId: string, category: Partial<InsertPortfolioCategory>): Promise<PortfolioCategory | undefined> {
    const existing = this.portfolioCats.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: PortfolioCategory = { ...existing, ...category };
    this.portfolioCats.set(id, updated);
    return updated;
  }

  async deletePortfolioCategory(id: string, userId: string): Promise<boolean> {
    const existing = this.portfolioCats.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.portfolioCats.delete(id);
  }

  // Portfolio Holdings
  async createPortfolioHolding(userId: string, holding: InsertPortfolioHolding): Promise<PortfolioHolding> {
    const id = randomUUID();
    const newHolding: PortfolioHolding = {
      id,
      userId,
      itemId: holding.itemId,
      itemName: holding.itemName,
      itemIcon: holding.itemIcon ?? null,
      quantity: holding.quantity ?? 1,
      avgBuyPrice: holding.avgBuyPrice,
      categoryId: holding.categoryId ?? null,
      source: holding.source ?? "manual",
      notes: holding.notes ?? null,
      lastValuedPrice: null,
      lastValuedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.portfolioHolds.set(id, newHolding);
    return newHolding;
  }

  async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    return Array.from(this.portfolioHolds.values())
      .filter(h => h.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async getPortfolioHolding(id: string): Promise<PortfolioHolding | undefined> {
    return this.portfolioHolds.get(id);
  }

  async updatePortfolioHolding(id: string, userId: string, holding: Partial<InsertPortfolioHolding & { lastValuedPrice?: number, lastValuedAt?: Date }>): Promise<PortfolioHolding | undefined> {
    const existing = this.portfolioHolds.get(id);
    if (!existing || existing.userId !== userId) return undefined;
    const updated: PortfolioHolding = { ...existing, ...holding, updatedAt: new Date() };
    this.portfolioHolds.set(id, updated);
    return updated;
  }

  async deletePortfolioHolding(id: string, userId: string): Promise<boolean> {
    const existing = this.portfolioHolds.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.portfolioHolds.delete(id);
  }

  // Portfolio Snapshots
  async createPortfolioSnapshot(userId: string, snapshot: { totalValue: number; totalCost: number; totalProfit: number; itemCount: number; snapshotDate: Date }): Promise<PortfolioSnapshot> {
    const id = randomUUID();
    const newSnap: PortfolioSnapshot = {
      id,
      userId,
      totalValue: snapshot.totalValue,
      totalCost: snapshot.totalCost,
      totalProfit: snapshot.totalProfit,
      itemCount: snapshot.itemCount,
      snapshotDate: snapshot.snapshotDate,
      createdAt: new Date(),
    };
    this.portfolioSnaps.set(id, newSnap);
    return newSnap;
  }

  async getPortfolioSnapshots(userId: string, limit?: number): Promise<PortfolioSnapshot[]> {
    const snaps = Array.from(this.portfolioSnaps.values())
      .filter(s => s.userId === userId)
      .sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());
    return limit ? snaps.slice(0, limit) : snaps;
  }

  async createSnapshotItems(snapshotId: string, items: Omit<PortfolioSnapshotItem, 'id'>[]): Promise<void> {
    for (const item of items) {
      const id = randomUUID();
      this.portfolioSnapItems.set(id, { id, ...item });
    }
  }

  async getSnapshotItems(snapshotId: string): Promise<PortfolioSnapshotItem[]> {
    return Array.from(this.portfolioSnapItems.values())
      .filter(i => i.snapshotId === snapshotId);
  }

  // Transaction Recording (MemStorage - limited support)
  private transactions: Map<string, FlipTransaction> = new Map();
  private volumeDaily: Map<string, ItemVolumeDaily> = new Map();
  private sessions: Map<string, UserSession> = new Map();

  async recordTransaction(tx: {
    flipId?: string;
    userId: string;
    itemId: number;
    itemName: string;
    transactionType: 'buy' | 'sell';
    price: number;
    quantity: number;
    taxPaid?: number;
    strategyTag?: string;
    transactionDate: Date;
  }): Promise<FlipTransaction> {
    const id = randomUUID();
    const totalValue = tx.price * tx.quantity;
    const record: FlipTransaction = {
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
      createdAt: new Date(),
    };
    this.transactions.set(id, record);
    return record;
  }

  async getTransactionsByItem(itemId: number, limit?: number): Promise<FlipTransaction[]> {
    const txs = Array.from(this.transactions.values())
      .filter(t => t.itemId === itemId)
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
    return limit ? txs.slice(0, limit) : txs;
  }

  async getAllTransactions(limit?: number): Promise<FlipTransaction[]> {
    const txs = Array.from(this.transactions.values())
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
    return limit ? txs.slice(0, limit) : txs;
  }

  async updateItemVolume(itemId: number, itemName: string, date: Date, txType: 'buy' | 'sell', price: number, quantity: number): Promise<void> {
    const dateKey = date.toISOString().split('T')[0];
    const key = `${itemId}-${dateKey}`;
    const existing = this.volumeDaily.get(key);
    const totalValue = price * quantity;
    
    if (existing) {
      existing.transactionCount = (existing.transactionCount || 0) + 1;
      existing.totalQuantity = (existing.totalQuantity || 0) + quantity;
      existing.totalValue = (existing.totalValue || 0) + totalValue;
      if (txType === 'buy') existing.buyCount = (existing.buyCount || 0) + 1;
      else existing.sellCount = (existing.sellCount || 0) + 1;
      existing.avgPrice = Math.round(existing.totalValue / existing.totalQuantity);
      existing.minPrice = existing.minPrice ? Math.min(existing.minPrice, price) : price;
      existing.maxPrice = existing.maxPrice ? Math.max(existing.maxPrice, price) : price;
      existing.updatedAt = new Date();
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
        buyCount: txType === 'buy' ? 1 : 0,
        sellCount: txType === 'sell' ? 1 : 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async getItemVolumeDaily(itemId: number, startDate: Date, endDate: Date): Promise<ItemVolumeDaily[]> {
    return Array.from(this.volumeDaily.values())
      .filter(v => v.itemId === itemId && v.date >= startDate && v.date <= endDate)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async getItemVolumeWeekly(itemId: number): Promise<{ week: string; transactionCount: number; totalQuantity: number; totalValue: number }[]> {
    return [];
  }

  async getItemVolumeMonthly(itemId: number): Promise<{ month: string; transactionCount: number; totalQuantity: number; totalValue: number }[]> {
    return [];
  }

  async updateUserHeartbeat(userId: string): Promise<void> {
    const existing = this.sessions.get(userId);
    const now = new Date();
    if (existing) {
      existing.lastHeartbeat = now;
      existing.status = "online";
    } else {
      this.sessions.set(userId, {
        id: randomUUID(),
        userId,
        lastHeartbeat: now,
        status: "online",
        createdAt: now,
      });
    }
    const user = this.users.get(userId);
    if (user) user.lastSeenAt = now;
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.lastSeenAt = new Date();
  }

  async getUserSession(userId: string): Promise<UserSession | undefined> {
    return this.sessions.get(userId);
  }

  async getAllUserSessions(): Promise<UserSession[]> {
    return Array.from(this.sessions.values());
  }

  async getOnlineUsers(thresholdMs: number = 60000): Promise<User[]> {
    const now = Date.now();
    const onlineUserIds = Array.from(this.sessions.values())
      .filter(s => s.lastHeartbeat && (now - new Date(s.lastHeartbeat).getTime()) < thresholdMs)
      .map(s => s.userId);
    return Array.from(this.users.values()).filter(u => onlineUserIds.includes(u.id));
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const user = this.users.get(userId);
    if (!user) return undefined;
    user.isAdmin = isAdmin;
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
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
    return await db.select().from(flips)
      .where(and(eq(flips.userId, userId), isNull(flips.deletedAt)))
      .orderBy(desc(flips.buyDate));
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

  async softDeleteFlip(id: string, userId: string): Promise<Flip | undefined> {
    const [updatedFlip] = await db
      .update(flips)
      .set({ deletedAt: new Date() })
      .where(and(eq(flips.id, id), eq(flips.userId, userId)))
      .returning();
    return updatedFlip || undefined;
  }

  async restoreFlip(id: string, userId: string): Promise<Flip | undefined> {
    const [updatedFlip] = await db
      .update(flips)
      .set({ deletedAt: null })
      .where(and(eq(flips.id, id), eq(flips.userId, userId)))
      .returning();
    return updatedFlip || undefined;
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

  async createFavorite(userId: string, favorite: InsertFavorite): Promise<Favorite> {
    const [newFavorite] = await db
      .insert(favorites)
      .values({ ...favorite, userId })
      .returning();
    return newFavorite;
  }

  async getFavorites(userId: string): Promise<Favorite[]> {
    return await db.select().from(favorites).where(eq(favorites.userId, userId)).orderBy(desc(favorites.createdAt));
  }

  async deleteFavorite(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(favorites).where(and(eq(favorites.id, id), eq(favorites.userId, userId))).returning();
    return result.length > 0;
  }

  async createProfitGoal(userId: string, goal: InsertProfitGoal): Promise<ProfitGoal> {
    const [newGoal] = await db
      .insert(profitGoals)
      .values({ ...goal, userId })
      .returning();
    return newGoal;
  }

  async getProfitGoals(userId: string): Promise<ProfitGoal[]> {
    return await db.select().from(profitGoals).where(eq(profitGoals.userId, userId)).orderBy(desc(profitGoals.createdAt));
  }

  async updateProfitGoal(id: string, userId: string, goal: Partial<InsertProfitGoal>): Promise<ProfitGoal | undefined> {
    const [updatedGoal] = await db
      .update(profitGoals)
      .set({ ...goal, updatedAt: new Date() })
      .where(and(eq(profitGoals.id, id), eq(profitGoals.userId, userId)))
      .returning();
    return updatedGoal || undefined;
  }

  async deleteProfitGoal(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(profitGoals).where(and(eq(profitGoals.id, id), eq(profitGoals.userId, userId))).returning();
    return result.length > 0;
  }

  // Portfolio Categories
  async createPortfolioCategory(userId: string, category: InsertPortfolioCategory): Promise<PortfolioCategory> {
    const [newCat] = await db
      .insert(portfolioCategories)
      .values({ ...category, userId })
      .returning();
    return newCat;
  }

  async getPortfolioCategories(userId: string): Promise<PortfolioCategory[]> {
    return await db.select().from(portfolioCategories).where(eq(portfolioCategories.userId, userId)).orderBy(portfolioCategories.name);
  }

  async updatePortfolioCategory(id: string, userId: string, category: Partial<InsertPortfolioCategory>): Promise<PortfolioCategory | undefined> {
    const [updatedCat] = await db
      .update(portfolioCategories)
      .set(category)
      .where(and(eq(portfolioCategories.id, id), eq(portfolioCategories.userId, userId)))
      .returning();
    return updatedCat || undefined;
  }

  async deletePortfolioCategory(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(portfolioCategories).where(and(eq(portfolioCategories.id, id), eq(portfolioCategories.userId, userId))).returning();
    return result.length > 0;
  }

  // Portfolio Holdings
  async createPortfolioHolding(userId: string, holding: InsertPortfolioHolding): Promise<PortfolioHolding> {
    const [newHolding] = await db
      .insert(portfolioHoldings)
      .values({ ...holding, userId })
      .returning();
    return newHolding;
  }

  async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    return await db.select().from(portfolioHoldings).where(eq(portfolioHoldings.userId, userId)).orderBy(desc(portfolioHoldings.createdAt));
  }

  async getPortfolioHolding(id: string): Promise<PortfolioHolding | undefined> {
    const [holding] = await db.select().from(portfolioHoldings).where(eq(portfolioHoldings.id, id));
    return holding || undefined;
  }

  async updatePortfolioHolding(id: string, userId: string, holding: Partial<InsertPortfolioHolding & { lastValuedPrice?: number, lastValuedAt?: Date }>): Promise<PortfolioHolding | undefined> {
    const [updatedHolding] = await db
      .update(portfolioHoldings)
      .set({ ...holding, updatedAt: new Date() })
      .where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId)))
      .returning();
    return updatedHolding || undefined;
  }

  async deletePortfolioHolding(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(portfolioHoldings).where(and(eq(portfolioHoldings.id, id), eq(portfolioHoldings.userId, userId))).returning();
    return result.length > 0;
  }

  // Portfolio Snapshots
  async createPortfolioSnapshot(userId: string, snapshot: { totalValue: number; totalCost: number; totalProfit: number; itemCount: number; snapshotDate: Date }): Promise<PortfolioSnapshot> {
    const [newSnap] = await db
      .insert(portfolioSnapshots)
      .values({ ...snapshot, userId })
      .returning();
    return newSnap;
  }

  async getPortfolioSnapshots(userId: string, limit?: number): Promise<PortfolioSnapshot[]> {
    const query = db.select().from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.userId, userId))
      .orderBy(desc(portfolioSnapshots.snapshotDate));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async createSnapshotItems(snapshotId: string, items: Omit<PortfolioSnapshotItem, 'id'>[]): Promise<void> {
    if (items.length === 0) return;
    await db.insert(portfolioSnapshotItems).values(items);
  }

  async getSnapshotItems(snapshotId: string): Promise<PortfolioSnapshotItem[]> {
    return await db.select().from(portfolioSnapshotItems).where(eq(portfolioSnapshotItems.snapshotId, snapshotId));
  }

  // Transaction Recording (for LLM training)
  async recordTransaction(tx: {
    flipId?: string;
    userId: string;
    itemId: number;
    itemName: string;
    transactionType: 'buy' | 'sell';
    price: number;
    quantity: number;
    taxPaid?: number;
    strategyTag?: string;
    transactionDate: Date;
  }): Promise<FlipTransaction> {
    const totalValue = tx.price * tx.quantity;
    const [record] = await db
      .insert(flipTransactions)
      .values({
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
        transactionDate: tx.transactionDate,
      })
      .returning();
    return record;
  }

  async getTransactionsByItem(itemId: number, limit?: number): Promise<FlipTransaction[]> {
    const query = db.select().from(flipTransactions)
      .where(eq(flipTransactions.itemId, itemId))
      .orderBy(desc(flipTransactions.transactionDate));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async getAllTransactions(limit?: number): Promise<FlipTransaction[]> {
    const query = db.select().from(flipTransactions)
      .orderBy(desc(flipTransactions.transactionDate));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async updateItemVolume(itemId: number, itemName: string, date: Date, txType: 'buy' | 'sell', price: number, quantity: number): Promise<void> {
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);
    
    const totalValue = price * quantity;
    
    const [existing] = await db.select().from(itemVolumeDaily)
      .where(and(
        eq(itemVolumeDaily.itemId, itemId),
        gte(itemVolumeDaily.date, dateStart),
        lte(itemVolumeDaily.date, dateEnd)
      ));
    
    if (existing) {
      await db.update(itemVolumeDaily)
        .set({
          transactionCount: (existing.transactionCount || 0) + 1,
          totalQuantity: (existing.totalQuantity || 0) + quantity,
          totalValue: (existing.totalValue || 0) + totalValue,
          avgPrice: Math.round(((existing.totalValue || 0) + totalValue) / ((existing.totalQuantity || 0) + quantity)),
          minPrice: existing.minPrice ? Math.min(existing.minPrice, price) : price,
          maxPrice: existing.maxPrice ? Math.max(existing.maxPrice, price) : price,
          buyCount: txType === 'buy' ? (existing.buyCount || 0) + 1 : existing.buyCount,
          sellCount: txType === 'sell' ? (existing.sellCount || 0) + 1 : existing.sellCount,
          updatedAt: new Date(),
        })
        .where(eq(itemVolumeDaily.id, existing.id));
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
        buyCount: txType === 'buy' ? 1 : 0,
        sellCount: txType === 'sell' ? 1 : 0,
      });
    }
  }

  async getItemVolumeDaily(itemId: number, startDate: Date, endDate: Date): Promise<ItemVolumeDaily[]> {
    return await db.select().from(itemVolumeDaily)
      .where(and(
        eq(itemVolumeDaily.itemId, itemId),
        gte(itemVolumeDaily.date, startDate),
        lte(itemVolumeDaily.date, endDate)
      ))
      .orderBy(desc(itemVolumeDaily.date));
  }

  async getItemVolumeWeekly(itemId: number): Promise<{ week: string; transactionCount: number; totalQuantity: number; totalValue: number }[]> {
    const result = await db.execute(sql`
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
    return result.rows as { week: string; transactionCount: number; totalQuantity: number; totalValue: number }[];
  }

  async getItemVolumeMonthly(itemId: number): Promise<{ month: string; transactionCount: number; totalQuantity: number; totalValue: number }[]> {
    const result = await db.execute(sql`
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
    return result.rows as { month: string; transactionCount: number; totalQuantity: number; totalValue: number }[];
  }

  // User Presence & Admin
  async updateUserHeartbeat(userId: string): Promise<void> {
    const now = new Date();
    const [existing] = await db.select().from(userSessions).where(eq(userSessions.userId, userId));
    
    if (existing) {
      await db.update(userSessions)
        .set({ lastHeartbeat: now, status: "online" })
        .where(eq(userSessions.userId, userId));
    } else {
      await db.insert(userSessions).values({
        userId,
        lastHeartbeat: now,
        status: "online",
      });
    }
    
    await db.update(users)
      .set({ lastSeenAt: now })
      .where(eq(users.id, userId));
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    await db.update(users)
      .set({ lastSeenAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getUserSession(userId: string): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.userId, userId));
    return session || undefined;
  }

  async getAllUserSessions(): Promise<UserSession[]> {
    return await db.select().from(userSessions);
  }

  async getOnlineUsers(thresholdMs: number = 60000): Promise<User[]> {
    const threshold = new Date(Date.now() - thresholdMs);
    const sessions = await db.select().from(userSessions)
      .where(gte(userSessions.lastHeartbeat, threshold));
    
    if (sessions.length === 0) return [];
    
    const userIds = sessions.map(s => s.userId);
    const onlineUsers = await db.select().from(users)
      .where(sql`${users.id} = ANY(${userIds})`);
    return onlineUsers;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async setUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ isAdmin })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
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
