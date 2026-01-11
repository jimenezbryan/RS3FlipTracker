import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertFlipSchema, insertWatchlistSchema, insertPriceAlertSchema, insertFavoriteSchema, insertProfitGoalSchema, insertPortfolioCategorySchema, insertPortfolioHoldingSchema, updatePortfolioHoldingSchema, insertHoldingTransactionSchema, insertRsAccountSchema, insertRecipeSchema, insertRecipeComponentSchema, insertRecipeRunSchema, insertRecipeRunComponentSchema } from "@shared/schema";
import { getItemPrice, searchItems, getItemTrend, getItemPriceHistory, getItemSuggestions } from "./ge-api";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processScreenshot, matchItemsToGE } from "./ocr";
import { analyzeRS3Screenshot } from "./ai-vision";
import { analyzeUserTradingProfile, getPersonalizedRecommendations } from "./ai-recommendations";
import { calculateFlipTax } from "@shared/taxCalculator";
import { sendFlipToDiscord, sendFlipUpdateToDiscord, sendGoalAchievementToDiscord, type GoalAchievement } from "./discord";
import { startOfDay, startOfWeek, startOfMonth, isAfter } from "date-fns";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// Helper to calculate profit for a flip
function calculateFlipProfit(flip: any): number {
  if (!flip.sellPrice) return 0;
  const buyPrice = Number(flip.buyPrice);
  const sellPrice = Number(flip.sellPrice);
  const quantity = flip.quantity ?? 1;
  const gross = (sellPrice - buyPrice) * quantity;
  // calculateFlipTax returns a TaxCalculation object, we need totalTax
  const taxCalc = calculateFlipTax(sellPrice, buyPrice, quantity, flip.itemId, flip.itemName);
  return gross - taxCalc.totalTax;
}

// Check for newly achieved goals after a flip is completed
async function checkGoalAchievements(
  userId: string,
  username: string,
  previousProfits: { daily: number; weekly: number; monthly: number }
): Promise<GoalAchievement[]> {
  console.log("[GoalCheck] Starting achievement check for user:", username);
  console.log("[GoalCheck] Previous profits:", previousProfits);
  
  const now = new Date();
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  // Get user's flips and calculate current profits
  const flips = await storage.getFlips(userId);
  let dailyProfit = 0;
  let weeklyProfit = 0;
  let monthlyProfit = 0;

  for (const flip of flips) {
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

  // Get user's goals
  const goals = await storage.getProfitGoals(userId);
  console.log("[GoalCheck] User has", goals.length, "goals configured");
  
  const achievements: GoalAchievement[] = [];

  for (const goal of goals) {
    const goalType = goal.goalType as "daily" | "weekly" | "monthly";
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

    // Check if we just crossed the goal threshold
    if (previousProfit < target && currentProfit >= target) {
      console.log(`[GoalCheck] ACHIEVEMENT UNLOCKED: ${goalType} goal of ${target} reached!`);
      achievements.push({
        goalType,
        targetAmount: target,
        currentProfit,
        username,
      });
    }
  }

  console.log("[GoalCheck] Total achievements found:", achievements.length);
  return achievements;
}

// Calculate current profit totals for a user
async function getCurrentProfits(userId: string): Promise<{ daily: number; weekly: number; monthly: number }> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const flips = await storage.getFlips(userId);
  let daily = 0;
  let weekly = 0;
  let monthly = 0;

  for (const flip of flips) {
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

export async function registerRoutes(app: Express): Promise<Server> {
  await setupAuth(app);

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
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
      
      const history = await getItemPriceHistory(itemId);
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
      
      // Enhance suggestions with transaction data from user community
      const transactions = await storage.getTransactionsByItem(itemId, 100);
      
      if (transactions.length > 0) {
        const buyTransactions = transactions.filter(t => t.transactionType === 'buy');
        const sellTransactions = transactions.filter(t => t.transactionType === 'sell');
        
        const avgUserBuyPrice = buyTransactions.length > 0
          ? Math.round(buyTransactions.reduce((sum, t) => sum + t.price, 0) / buyTransactions.length)
          : null;
        const avgUserSellPrice = sellTransactions.length > 0
          ? Math.round(sellTransactions.reduce((sum, t) => sum + t.price, 0) / sellTransactions.length)
          : null;
        
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
            dataSource: "RS3 Flip Tracker community trades",
          },
        });
      } else {
        res.json({
          ...suggestions,
          communityData: null,
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  app.get("/api/ai/trading-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips = await storage.getFlips(userId);
      const profile = analyzeUserTradingProfile(flips);
      res.json(profile);
    } catch (error) {
      console.error("Error analyzing trading profile:", error);
      res.status(500).json({ error: "Failed to analyze trading profile" });
    }
  });

  app.get("/api/ai/recommendations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips = await storage.getFlips(userId);
      
      if (flips.length < 3) {
        return res.json({
          recommendations: [],
          message: "Complete at least 3 flips to get personalized recommendations",
          profile: null,
        });
      }
      
      const profile = analyzeUserTradingProfile(flips);
      const recommendations = await getPersonalizedRecommendations(profile, flips);
      
      res.json({
        recommendations,
        profile,
        message: recommendations.length > 0 ? null : "No recommendations available at this time",
      });
    } catch (error) {
      console.error("Error generating recommendations:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // Admin emails for checking admin privileges
  const ADMIN_EMAILS = [
    "fjnovarum@gmail.com",
    "bjimenez@virtualsyncsolutions.com"
  ];

  app.get("/api/flips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Check if user is an admin
      const isAdminUser = user && (ADMIN_EMAILS.includes(user.email ?? "") || user.isAdmin === true);
      
      // Query parameters for filtering
      const scope = req.query.scope as string | undefined; // 'mine' | 'all'
      const filterUserId = req.query.userId as string | undefined;
      
      // Non-admins can only see their own flips
      if (!isAdminUser) {
        if (scope === 'all' || filterUserId) {
          return res.status(403).json({ error: "Admin access required to view other users' flips" });
        }
        const userFlips = await storage.getFlips(userId);
        return res.json(userFlips);
      }
      
      // Admin users - handle scope and filtering
      if (scope === 'all') {
        // Get all flips from all users with user info
        const allFlips = await storage.getAllFlips();
        
        // Optionally filter by specific user
        if (filterUserId) {
          const filteredFlips = allFlips.filter(flip => flip.userId === filterUserId);
          return res.json(filteredFlips);
        }
        
        return res.json(allFlips);
      }
      
      // Default: admin sees only their own flips (scope='mine' or no scope)
      const adminFlips = await storage.getFlips(userId);
      res.json(adminFlips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flips" });
    }
  });

  app.post("/api/flips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const validatedFlip = insertFlipSchema.parse(req.body);
      
      // Auto-set sellDate to today if sellPrice is present but sellDate is missing
      if (validatedFlip.sellPrice && !validatedFlip.sellDate) {
        validatedFlip.sellDate = new Date();
        console.log("[FlipCreate] Auto-setting sellDate to today since sellPrice was provided");
      }
      
      // Capture previous profits BEFORE creating the flip (for goal achievement detection)
      const previousProfits = await getCurrentProfits(userId);
      
      const newFlip = await storage.createFlip(userId, validatedFlip);
      
      // Record buy transaction for analytics/LLM training
      if (newFlip.itemId) {
        await storage.recordTransaction({
          flipId: newFlip.id,
          userId,
          itemId: newFlip.itemId,
          itemName: newFlip.itemName,
          transactionType: 'buy',
          price: newFlip.buyPrice,
          quantity: newFlip.quantity ?? 1,
          strategyTag: newFlip.strategyTag ?? undefined,
          transactionDate: new Date(newFlip.buyDate),
        });
        await storage.updateItemVolume(
          newFlip.itemId, 
          newFlip.itemName, 
          new Date(newFlip.buyDate), 
          'buy', 
          newFlip.buyPrice, 
          newFlip.quantity ?? 1
        );
        
        // Record sell transaction if selling immediately
        if (newFlip.sellPrice && newFlip.sellDate) {
          const sellValue = newFlip.sellPrice * (newFlip.quantity ?? 1);
          const taxPaid = Math.floor(newFlip.sellPrice * 0.02) * (newFlip.quantity ?? 1); // 2% per item, floored
          await storage.recordTransaction({
            flipId: newFlip.id,
            userId,
            itemId: newFlip.itemId,
            itemName: newFlip.itemName,
            transactionType: 'sell',
            price: newFlip.sellPrice,
            quantity: newFlip.quantity ?? 1,
            taxPaid,
            strategyTag: newFlip.strategyTag ?? undefined,
            transactionDate: new Date(newFlip.sellDate),
          });
          await storage.updateItemVolume(
            newFlip.itemId, 
            newFlip.itemName, 
            new Date(newFlip.sellDate), 
            'sell', 
            newFlip.sellPrice, 
            newFlip.quantity ?? 1
          );
        }
      }
      
      // Send to Discord (fire and forget - don't block response)
      sendFlipToDiscord(newFlip).catch(err => {
        console.error("[Discord] Failed to send flip:", err);
      });
      
      // Check for goal achievements if this is a completed flip
      let achievements: GoalAchievement[] = [];
      console.log("[FlipCreate] Checking for completed flip - sellPrice:", newFlip.sellPrice, "sellDate:", newFlip.sellDate);
      if (newFlip.sellPrice && newFlip.sellDate && user) {
        console.log("[FlipCreate] Flip is completed, running goal achievement check...");
        achievements = await checkGoalAchievements(userId, user.username || user.email || "Trader", previousProfits);
        
        // Send Discord notifications for each achievement
        for (const achievement of achievements) {
          sendGoalAchievementToDiscord(achievement).catch(err => {
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

  app.patch("/api/flips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // Check if user is admin
      const user = await storage.getUser(userId);
      const isAdminUser = user && (ADMIN_EMAILS.includes(user.email ?? "") || user.isAdmin === true);
      
      // Get the current flip before updating
      const existingFlip = await storage.getFlip(id);
      
      // Capture previous profits BEFORE updating (for goal achievement detection)
      // Use the flip owner's userId, not the admin's
      const flipOwnerId = existingFlip?.userId || userId;
      const flipOwner = existingFlip?.userId ? await storage.getUser(existingFlip.userId) : user;
      const previousProfits = await getCurrentProfits(flipOwnerId);
      
      const validatedFlip = insertFlipSchema.partial().parse(req.body);
      
      // Auto-set sellDate to today if sellPrice is being added but sellDate is missing
      if (validatedFlip.sellPrice && !validatedFlip.sellDate && !existingFlip?.sellDate) {
        validatedFlip.sellDate = new Date();
        console.log("[FlipUpdate] Auto-setting sellDate to today since sellPrice was provided");
      }
      
      // Admins can edit any flip, regular users can only edit their own
      const updatedFlip = await storage.updateFlip(id, userId, validatedFlip, isAdminUser);
      
      if (!updatedFlip) {
        return res.status(404).json({ error: "Flip not found" });
      }
      
      // If this update is adding a sell price (completing the flip), record the sell transaction
      // Use the flip owner's userId for transaction recording, not the admin's userId
      if (updatedFlip.itemId && updatedFlip.sellPrice && updatedFlip.sellDate && 
          (!existingFlip?.sellPrice || existingFlip.sellPrice !== updatedFlip.sellPrice)) {
        const sellValue = updatedFlip.sellPrice * (updatedFlip.quantity ?? 1);
        const taxPaid = Math.floor(updatedFlip.sellPrice * 0.02) * (updatedFlip.quantity ?? 1); // 2% per item, floored
        await storage.recordTransaction({
          flipId: updatedFlip.id,
          userId: updatedFlip.userId,
          itemId: updatedFlip.itemId,
          itemName: updatedFlip.itemName,
          transactionType: 'sell',
          price: updatedFlip.sellPrice,
          quantity: updatedFlip.quantity ?? 1,
          taxPaid,
          strategyTag: updatedFlip.strategyTag ?? undefined,
          transactionDate: new Date(updatedFlip.sellDate),
        });
        await storage.updateItemVolume(
          updatedFlip.itemId, 
          updatedFlip.itemName, 
          new Date(updatedFlip.sellDate), 
          'sell', 
          updatedFlip.sellPrice, 
          updatedFlip.quantity ?? 1
        );
      }
      
      // Send update notification to Discord (fire and forget)
      if (existingFlip) {
        sendFlipUpdateToDiscord(existingFlip, updatedFlip).catch(err => {
          console.error("[Discord] Failed to send flip update:", err);
        });
      }
      
      // Check for goal achievements if this flip is being completed (sellPrice added)
      let achievements: GoalAchievement[] = [];
      const isNewlyCompleted = updatedFlip.sellPrice && updatedFlip.sellDate && 
        (!existingFlip?.sellPrice || existingFlip.sellPrice !== updatedFlip.sellPrice);
      
      if (isNewlyCompleted && flipOwner) {
        achievements = await checkGoalAchievements(
          flipOwnerId, 
          flipOwner.username || flipOwner.email || "Trader", 
          previousProfits
        );
        
        // Send Discord notifications for each achievement
        for (const achievement of achievements) {
          sendGoalAchievementToDiscord(achievement).catch(err => {
            console.error("[Discord] Failed to send goal achievement:", err);
          });
        }
      }
      
      res.json({ ...updatedFlip, achievements });
    } catch (error) {
      res.status(400).json({ error: "Invalid flip data" });
    }
  });

  app.delete("/api/flips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { soft } = req.query;
      
      if (soft === 'true') {
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

  app.post("/api/flips/:id/restore", isAuthenticated, async (req: any, res) => {
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

  // Item Summary Leaderboard - aggregated performance by item
  app.get("/api/stats/item-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips = await storage.getFlips(userId);
      
      // Only include completed flips (have sellDate)
      const completedFlips = flips.filter(f => f.sellDate !== null);
      
      // Aggregate by item
      const itemStats = new Map<string, {
        itemName: string;
        itemId: number | null;
        itemIcon: string | null;
        totalProfit: number;
        totalQuantity: number;
        totalBuyCost: number;
        tradeCount: number;
        wins: number;
        roiSum: number;
        avgHoldTime: number[];
      }>();

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
          avgHoldTime: [],
        };

        if (flip.sellPrice !== null && flip.sellPrice !== undefined) {
          // Calculate profit with tax using shared calculator (handles bonds, low-price exemptions)
          const taxDetails = calculateFlipTax(
            flip.sellPrice, 
            flip.buyPrice, 
            flip.quantity, 
            flip.itemId ?? undefined, 
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

          // Calculate hold time
          if (flip.buyDate && flip.sellDate) {
            const holdDays = Math.floor(
              (new Date(flip.sellDate).getTime() - new Date(flip.buyDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            existing.avgHoldTime.push(holdDays);
          }

          // Update icon if we have one
          if (flip.itemIcon && !existing.itemIcon) {
            existing.itemIcon = flip.itemIcon;
          }
          // Update itemId if we have one
          if (flip.itemId && !existing.itemId) {
            existing.itemId = flip.itemId;
          }
        }

        itemStats.set(key, existing);
      }

      // Convert to array and calculate final metrics
      const result = Array.from(itemStats.values()).map(item => ({
        itemName: item.itemName,
        itemId: item.itemId,
        itemIcon: item.itemIcon,
        totalProfit: Math.round(item.totalProfit),
        totalQuantity: item.totalQuantity,
        tradeCount: item.tradeCount,
        avgROI: item.tradeCount > 0 ? Math.round((item.roiSum / item.tradeCount) * 100) / 100 : 0,
        winRate: item.tradeCount > 0 ? Math.round((item.wins / item.tradeCount) * 100 * 10) / 10 : 0,
        avgHoldTime: item.avgHoldTime.length > 0 
          ? Math.round(item.avgHoldTime.reduce((a, b) => a + b, 0) / item.avgHoldTime.length) 
          : 0,
      }));

      // Sort by total profit descending by default
      result.sort((a, b) => b.totalProfit - a.totalProfit);

      res.json(result);
    } catch (error) {
      console.error("Failed to get item summary:", error);
      res.status(500).json({ error: "Failed to fetch item summary" });
    }
  });

  app.get("/api/watchlist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getWatchlist(userId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedItem = insertWatchlistSchema.parse(req.body);
      const newItem = await storage.createWatchlistItem(userId, validatedItem);
      res.status(201).json(newItem);
    } catch (error) {
      res.status(400).json({ error: "Invalid watchlist item data" });
    }
  });

  app.patch("/api/watchlist/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/watchlist/:id", isAuthenticated, async (req: any, res) => {
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

  // Community Prices - Aggregates real trade data from all users
  app.get("/api/community-prices", isAuthenticated, async (req: any, res) => {
    try {
      // Get all completed flips from all users to build community price data
      const allFlips = await storage.getAllFlips();
      const completedFlips = allFlips.filter(f => f.sellPrice && !f.deletedAt);
      
      // Group by item and calculate community prices
      const itemMap = new Map<number, {
        itemId: number;
        itemName: string;
        itemIcon?: string;
        buyPrices: number[];
        sellPrices: number[];
        profits: number[];
        rois: number[];
        traders: Set<string>;
        lastTradeDate: Date;
      }>();

      for (const flip of completedFlips) {
        if (!flip.itemId) continue;
        
        const existing = itemMap.get(flip.itemId);
        const buyPrice = Number(flip.buyPrice);
        const sellPrice = Number(flip.sellPrice!);
        const profit = (sellPrice - buyPrice) * flip.quantity;
        const tax = calculateFlipTax(flip.itemName, sellPrice, flip.quantity);
        const netProfit = profit - tax;
        const roi = buyPrice > 0 ? (netProfit / (buyPrice * flip.quantity)) * 100 : 0;
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
            itemIcon: flip.itemIcon || undefined,
            buyPrices: [buyPrice],
            sellPrices: [sellPrice],
            profits: [netProfit],
            rois: [roi],
            traders: new Set([flip.userId]),
            lastTradeDate: tradeDate,
          });
        }
      }

      // Calculate final stats and confidence
      const result = await Promise.all(Array.from(itemMap.values()).map(async (item) => {
        const avgBuy = Math.round(item.buyPrices.reduce((a, b) => a + b, 0) / item.buyPrices.length);
        const avgSell = Math.round(item.sellPrices.reduce((a, b) => a + b, 0) / item.sellPrices.length);
        const avgProfit = Math.round(item.profits.reduce((a, b) => a + b, 0) / item.profits.length);
        const avgRoi = item.rois.reduce((a, b) => a + b, 0) / item.rois.length;
        const tradeCount = item.buyPrices.length;
        const uniqueTraders = item.traders.size;
        const daysSinceLastTrade = Math.floor((Date.now() - item.lastTradeDate.getTime()) / (1000 * 60 * 60 * 24));
        
        // Get current GE price for comparison
        let gePriceValue = 0;
        try {
          const geData = await getItemPrice(item.itemName);
          if (geData) gePriceValue = geData.price;
        } catch {}

        // Calculate confidence based on trade count, trader count, and recency
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (tradeCount >= 10 && uniqueTraders >= 3 && daysSinceLastTrade <= 7) {
          confidence = 'high';
        } else if (tradeCount >= 5 && uniqueTraders >= 2 && daysSinceLastTrade <= 14) {
          confidence = 'medium';
        }

        // Calculate price accuracy (how close community price is to GE)
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
          priceAccuracy,
        };
      }));

      // Filter out items with no GE price data and sort by trade count
      const filtered = result.filter(r => r.tradeCount >= 1);
      filtered.sort((a, b) => b.tradeCount - a.tradeCount);

      res.json(filtered.slice(0, 50)); // Return top 50 items
    } catch (error) {
      console.error("Failed to get community prices:", error);
      res.status(500).json({ error: "Failed to fetch community prices" });
    }
  });

  // Hot items - Most traded in last 7 days
  app.get("/api/community-prices/hot", isAuthenticated, async (req: any, res) => {
    try {
      const allFlips = await storage.getAllFlips();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentFlips = allFlips.filter(f => 
        f.sellPrice && !f.deletedAt && 
        (f.sellDate || f.buyDate) >= sevenDaysAgo
      );

      // Group by item and count trades
      const itemCounts = new Map<number, {
        itemId: number;
        itemName: string;
        itemIcon?: string;
        tradeCount: number;
        traders: Set<string>;
      }>();

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
            itemIcon: flip.itemIcon || undefined,
            tradeCount: 1,
            traders: new Set([flip.userId]),
          });
        }
      }

      const result = Array.from(itemCounts.values()).map(item => ({
        itemId: item.itemId,
        itemName: item.itemName,
        itemIcon: item.itemIcon,
        tradeCount: item.tradeCount,
        uniqueTraders: item.traders.size,
        confidence: item.tradeCount >= 5 && item.traders.size >= 2 ? 'high' as const : 
                   item.tradeCount >= 2 ? 'medium' as const : 'low' as const,
      }));

      result.sort((a, b) => b.tradeCount - a.tradeCount);
      res.json(result.slice(0, 10));
    } catch (error) {
      console.error("Failed to get hot items:", error);
      res.status(500).json({ error: "Failed to fetch hot items" });
    }
  });

  // Lookup specific item community price
  app.get("/api/community-prices/lookup", isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.query.itemId as string);
      const itemName = req.query.itemName as string;
      
      if (isNaN(itemId) && !itemName) {
        return res.status(400).json({ error: "Invalid item ID or name" });
      }

      const allFlips = await storage.getAllFlips();
      // Match by itemId OR by itemName (case-insensitive) to handle variations
      const itemFlips = allFlips.filter(f => {
        if (!f.sellPrice || f.deletedAt) return false;
        if (f.itemId === itemId) return true;
        if (itemName && f.itemName.toLowerCase() === itemName.toLowerCase()) return true;
        return false;
      });

      if (itemFlips.length === 0) {
        return res.json(null);
      }

      const buyPrices = itemFlips.map(f => Number(f.buyPrice));
      const sellPrices = itemFlips.map(f => Number(f.sellPrice!));
      const traders = new Set(itemFlips.map(f => f.userId));
      const latestTrade = itemFlips.reduce((latest, f) => {
        const date = f.sellDate || f.buyDate;
        return date > latest ? date : latest;
      }, itemFlips[0].sellDate || itemFlips[0].buyDate);

      const avgBuy = Math.round(buyPrices.reduce((a, b) => a + b, 0) / buyPrices.length);
      const avgSell = Math.round(sellPrices.reduce((a, b) => a + b, 0) / sellPrices.length);
      const tradeCount = itemFlips.length;
      const uniqueTraders = traders.size;
      const daysSinceLastTrade = Math.floor((Date.now() - latestTrade.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate confidence
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (tradeCount >= 10 && uniqueTraders >= 3 && daysSinceLastTrade <= 7) {
        confidence = 'high';
      } else if (tradeCount >= 5 && uniqueTraders >= 2 && daysSinceLastTrade <= 14) {
        confidence = 'medium';
      }

      // Calculate profits and ROI
      const profits = itemFlips.map(f => {
        const buyPrice = Number(f.buyPrice);
        const sellPrice = Number(f.sellPrice!);
        const gross = (sellPrice - buyPrice) * f.quantity;
        const tax = calculateFlipTax(f.itemName, sellPrice, f.quantity);
        return gross - tax;
      });
      const rois = itemFlips.map(f => {
        const buyPrice = Number(f.buyPrice);
        const sellPrice = Number(f.sellPrice!);
        const netProfit = (sellPrice - buyPrice) * f.quantity - calculateFlipTax(f.itemName, sellPrice, f.quantity);
        return buyPrice > 0 ? (netProfit / (buyPrice * f.quantity)) * 100 : 0;
      });

      // Get GE price
      let gePriceValue = 0;
      try {
        const geData = await getItemPrice(itemFlips[0].itemName);
        if (geData) gePriceValue = geData.price;
      } catch {}

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
        avgRoi: Math.round((rois.reduce((a, b) => a + b, 0) / rois.length) * 100) / 100,
        confidence,
        priceAccuracy: 0,
      });
    } catch (error) {
      console.error("Failed to lookup community price:", error);
      res.status(500).json({ error: "Failed to lookup community price" });
    }
  });

  app.get("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const alerts = await storage.getPriceAlerts(userId);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch price alerts" });
    }
  });

  app.post("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedAlert = insertPriceAlertSchema.parse(req.body);
      const newAlert = await storage.createPriceAlert(userId, validatedAlert);
      res.status(201).json(newAlert);
    } catch (error) {
      res.status(400).json({ error: "Invalid price alert data" });
    }
  });

  app.patch("/api/alerts/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/alerts/:id", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getFavorites(userId);
      res.json(favorites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch favorites" });
    }
  });

  app.post("/api/favorites", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedFavorite = insertFavoriteSchema.parse(req.body);
      const newFavorite = await storage.createFavorite(userId, validatedFavorite);
      res.status(201).json(newFavorite);
    } catch (error) {
      res.status(400).json({ error: "Invalid favorite data" });
    }
  });

  app.delete("/api/favorites/:id", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const goals = await storage.getProfitGoals(userId);
      res.json(goals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch profit goals" });
    }
  });

  app.post("/api/goals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedGoal = insertProfitGoalSchema.parse(req.body);
      const newGoal = await storage.createProfitGoal(userId, validatedGoal);
      res.status(201).json(newGoal);
    } catch (error) {
      res.status(400).json({ error: "Invalid profit goal data" });
    }
  });

  app.patch("/api/goals/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/goals/:id", isAuthenticated, async (req: any, res) => {
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

  // Check which goals are currently met (for first-load celebrations)
  app.get("/api/goals/check-met", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Get current profits
      const currentProfits = await getCurrentProfits(userId);
      
      // Get user's goals
      const goals = await storage.getProfitGoals(userId);
      
      // Check which goals are met
      const metGoals: Array<{
        goalType: string;
        targetAmount: number;
        currentProfit: number;
        username: string;
      }> = [];
      
      for (const goal of goals) {
        const goalType = goal.goalType as "daily" | "weekly" | "monthly";
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
            username: user?.username || user?.email || "Trader",
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

  // Portfolio Categories
  app.get("/api/portfolio/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categories = await storage.getPortfolioCategories(userId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/portfolio/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedCategory = insertPortfolioCategorySchema.parse(req.body);
      const newCategory = await storage.createPortfolioCategory(userId, validatedCategory);
      res.status(201).json(newCategory);
    } catch (error) {
      res.status(400).json({ error: "Invalid category data" });
    }
  });

  app.patch("/api/portfolio/categories/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/portfolio/categories/:id", isAuthenticated, async (req: any, res) => {
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

  // Portfolio Holdings
  app.get("/api/portfolio/holdings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      res.json(holdings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch holdings" });
    }
  });

  app.post("/api/portfolio/holdings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedHolding = insertPortfolioHoldingSchema.parse(req.body);
      const newHolding = await storage.createPortfolioHolding(userId, validatedHolding);
      res.status(201).json(newHolding);
    } catch (error) {
      res.status(400).json({ error: "Invalid holding data" });
    }
  });

  app.patch("/api/portfolio/holdings/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const validatedHolding = updatePortfolioHoldingSchema.parse(req.body);
      const holdingData = {
        ...validatedHolding,
        notes: validatedHolding.notes === null ? undefined : validatedHolding.notes,
        categoryId: validatedHolding.categoryId === null ? undefined : validatedHolding.categoryId,
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

  app.delete("/api/portfolio/holdings/:id", isAuthenticated, async (req: any, res) => {
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

  // Portfolio Holding Transactions
  app.get("/api/portfolio/holdings/:holdingId/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const { holdingId } = req.params;
      const userId = req.user.claims.sub;
      const transactions = await storage.getHoldingTransactions(holdingId, userId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/portfolio/holdings/:holdingId/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const { holdingId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify holding exists and belongs to user
      const holding = await storage.getPortfolioHolding(holdingId);
      if (!holding || holding.userId !== userId) {
        return res.status(404).json({ error: "Holding not found" });
      }
      
      const validatedTx = insertHoldingTransactionSchema.parse({
        ...req.body,
        holdingId,
      });
      
      // Validate sell quantity doesn't exceed current holdings
      if (validatedTx.transactionType === 'sell') {
        if (validatedTx.quantity > holding.quantity) {
          return res.status(400).json({ 
            error: `Cannot sell ${validatedTx.quantity} units - only ${holding.quantity} held` 
          });
        }
      }
      
      // Create the transaction
      const newTx = await storage.createHoldingTransaction(userId, validatedTx);
      
      // Recalculate holding aggregates based on all transactions
      const allTxs = await storage.getHoldingTransactions(holdingId, userId);
      
      let totalQuantity = 0;
      let totalCost = 0;
      let realizedProfit = 0;
      let realizedLoss = 0;
      
      // Sort transactions by date to process in order
      const sortedTxs = [...allTxs].sort((a, b) => 
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );
      
      for (const tx of sortedTxs) {
        if (tx.transactionType === 'buy') {
          totalCost += tx.totalValue;
          totalQuantity += tx.quantity;
        } else if (tx.transactionType === 'sell') {
          // Calculate P&L on sell based on avg cost at time of sale
          const avgCostPerUnit = totalQuantity > 0 ? totalCost / totalQuantity : 0;
          const costBasis = avgCostPerUnit * tx.quantity;
          const proceeds = tx.totalValue - (tx.fees || 0);
          const pnl = proceeds - costBasis;
          
          if (pnl >= 0) {
            realizedProfit += pnl;
          } else {
            realizedLoss += Math.abs(pnl);
          }
          
          // Reduce cost and quantity (clamp to prevent negative values)
          totalCost = Math.max(0, totalCost - costBasis);
          totalQuantity = Math.max(0, totalQuantity - tx.quantity);
        }
      }
      
      // Calculate new avgBuyPrice (guard against division by zero)
      const avgBuyPrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;
      
      // Update holding with new aggregates
      await storage.updatePortfolioHolding(holdingId, userId, {
        quantity: totalQuantity,
        avgBuyPrice: Math.round(avgBuyPrice),
        totalCost: Math.round(totalCost),
        realizedProfit: Math.round(realizedProfit),
        realizedLoss: Math.round(realizedLoss),
      });
      
      // Return transaction with updated P&L if it was a sell
      res.status(201).json(newTx);
    } catch (error) {
      console.error("Failed to create transaction:", error);
      res.status(400).json({ error: "Invalid transaction data" });
    }
  });

  app.delete("/api/portfolio/holdings/:holdingId/transactions/:txId", isAuthenticated, async (req: any, res) => {
    try {
      const { holdingId, txId } = req.params;
      const userId = req.user.claims.sub;
      
      const success = await storage.deleteHoldingTransaction(txId, userId);
      if (!success) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      // Recalculate holding aggregates after deletion
      const allTxs = await storage.getHoldingTransactions(holdingId, userId);
      
      let totalQuantity = 0;
      let totalCost = 0;
      let realizedProfit = 0;
      let realizedLoss = 0;
      
      const sortedTxs = [...allTxs].sort((a, b) => 
        new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
      );
      
      for (const tx of sortedTxs) {
        if (tx.transactionType === 'buy') {
          totalCost += tx.totalValue;
          totalQuantity += tx.quantity;
        } else if (tx.transactionType === 'sell') {
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
        realizedLoss: Math.round(realizedLoss),
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete transaction:", error);
      res.status(500).json({ error: "Failed to delete transaction" });
    }
  });

  // Screenshot upload with AI vision analysis
  app.post("/api/portfolio/import/screenshot", isAuthenticated, upload.single("screenshot"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No screenshot uploaded" });
      }

      // Use AI vision to analyze the screenshot
      const aiResult = await analyzeRS3Screenshot(req.file.buffer);
      
      if (!aiResult.success) {
        // Fallback to basic OCR if AI fails
        console.warn("[Import] AI vision failed, falling back to OCR:", aiResult.error);
        const ocrResult = await processScreenshot(req.file.buffer);
        const matchedItems = await matchItemsToGE(ocrResult.items, async (query) => {
          const items = await searchItems(query);
          return items.slice(0, 5);
        });

        return res.json({
          items: matchedItems,
          rawText: ocrResult.rawText,
          overallConfidence: ocrResult.overallConfidence,
          method: "ocr",
        });
      }

      // Match AI-identified items to GE database
      const matchedItems = await Promise.all(
        aiResult.items.map(async (item) => {
          try {
            const searchResults = await searchItems(item.name);
            const bestMatch = searchResults.length > 0 ? searchResults[0] : null;
            
            return {
              original: {
                name: item.name,
                quantity: item.quantity,
                confidence: item.confidence,
              },
              match: bestMatch,
              matchConfidence: bestMatch ? item.confidence * 0.9 : 0,
              notes: item.notes,
            };
          } catch (e) {
            return {
              original: {
                name: item.name,
                quantity: item.quantity,
                confidence: item.confidence,
              },
              match: null,
              matchConfidence: 0,
              notes: item.notes,
            };
          }
        })
      );

      res.json({
        items: matchedItems,
        rawText: aiResult.rawResponse,
        overallConfidence: matchedItems.length > 0 
          ? matchedItems.reduce((sum, i) => sum + i.original.confidence, 0) / matchedItems.length 
          : 0,
        method: "ai",
      });
    } catch (error) {
      console.error("Screenshot processing error:", error);
      res.status(500).json({ error: "Failed to process screenshot" });
    }
  });

  // Bulk import holdings from screenshot results
  app.post("/api/portfolio/import/confirm", isAuthenticated, async (req: any, res) => {
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
          source: "screenshot",
        });
        const holding = await storage.createPortfolioHolding(userId, validatedHolding);
        createdHoldings.push(holding);
      }

      res.status(201).json(createdHoldings);
    } catch (error) {
      res.status(400).json({ error: "Invalid import data" });
    }
  });

  // Portfolio Snapshots and Value Tracking
  app.get("/api/portfolio/snapshots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const snapshots = await storage.getPortfolioSnapshots(userId, limit);
      res.json(snapshots);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch snapshots" });
    }
  });

  app.post("/api/portfolio/snapshots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      
      if (holdings.length === 0) {
        return res.status(400).json({ error: "No holdings to snapshot" });
      }

      let totalValue = 0;
      let totalCost = 0;
      const snapshotItems: any[] = [];

      for (const holding of holdings) {
        let currentPrice = holding.lastValuedPrice || holding.avgBuyPrice;
        
        try {
          const priceData = await getItemPrice(holding.itemName);
          if (priceData) {
            currentPrice = priceData.price;
            await storage.updatePortfolioHolding(holding.id, userId, {
              lastValuedPrice: currentPrice,
              lastValuedAt: new Date(),
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
          categoryId: holding.categoryId,
        });
      }

      const snapshot = await storage.createPortfolioSnapshot(userId, {
        totalValue,
        totalCost,
        totalProfit: totalValue - totalCost,
        itemCount: holdings.length,
        snapshotDate: new Date(),
      });

      await storage.createSnapshotItems(snapshot.id, snapshotItems.map(item => ({
        snapshotId: snapshot.id,
        ...item,
      })));

      res.status(201).json({
        ...snapshot,
        items: snapshotItems,
      });
    } catch (error) {
      console.error("Snapshot creation error:", error);
      res.status(500).json({ error: "Failed to create snapshot" });
    }
  });

  app.get("/api/portfolio/snapshots/:id/items", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const items = await storage.getSnapshotItems(id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch snapshot items" });
    }
  });

  // Portfolio summary with current values
  app.get("/api/portfolio/summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const holdings = await storage.getPortfolioHoldings(userId);
      const categories = await storage.getPortfolioCategories(userId);

      let totalValue = 0;
      let totalCost = 0;
      let totalRealizedProfit = 0;
      let totalRealizedLoss = 0;
      const holdingsWithValues: Array<typeof holdings[0] & { currentPrice: number; value: number; profit: number; profitPercent: number; allocation: number }> = [];

      // First pass: calculate totals
      for (const holding of holdings) {
        const currentPrice = holding.lastValuedPrice || holding.avgBuyPrice;
        const value = currentPrice * holding.quantity;
        const cost = holding.avgBuyPrice * holding.quantity;
        totalValue += value;
        totalCost += cost;
        totalRealizedProfit += holding.realizedProfit || 0;
        totalRealizedLoss += holding.realizedLoss || 0;
      }

      // Second pass: add allocation percentages
      for (const holding of holdings) {
        const currentPrice = holding.lastValuedPrice || holding.avgBuyPrice;
        const value = currentPrice * holding.quantity;
        const cost = holding.avgBuyPrice * holding.quantity;
        const allocation = totalValue > 0 ? (value / totalValue) * 100 : 0;

        holdingsWithValues.push({
          ...holding,
          currentPrice,
          value,
          profit: value - cost,
          profitPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0,
          allocation,
        });
      }

      const categoryBreakdown = categories.map(cat => {
        const catHoldings = holdingsWithValues.filter(h => h.categoryId === cat.id);
        const catValue = catHoldings.reduce((sum, h) => sum + h.value, 0);
        const catCost = catHoldings.reduce((sum, h) => sum + (h.avgBuyPrice * h.quantity), 0);
        return {
          ...cat,
          holdingCount: catHoldings.length,
          totalValue: catValue,
          totalCost: catCost,
          totalProfit: catValue - catCost,
          profitPercent: catCost > 0 ? ((catValue - catCost) / catCost) * 100 : 0,
        };
      });

      const uncategorized = holdingsWithValues.filter(h => !h.categoryId);
      if (uncategorized.length > 0) {
        const uncatValue = uncategorized.reduce((sum, h) => sum + h.value, 0);
        const uncatCost = uncategorized.reduce((sum, h) => sum + (h.avgBuyPrice * h.quantity), 0);
        categoryBreakdown.push({
          id: null,
          name: "Uncategorized",
          color: "#6b7280",
          holdingCount: uncategorized.length,
          totalValue: uncatValue,
          totalCost: uncatCost,
          totalProfit: uncatValue - uncatCost,
          profitPercent: uncatCost > 0 ? ((uncatValue - uncatCost) / uncatCost) * 100 : 0,
        } as any);
      }

      res.json({
        totalValue,
        totalCost,
        totalProfit: totalValue - totalCost,
        profitPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        totalRealizedProfit,
        totalRealizedLoss,
        netRealizedProfit: totalRealizedProfit - totalRealizedLoss,
        holdingCount: holdings.length,
        holdings: holdingsWithValues,
        categories: categoryBreakdown,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio summary" });
    }
  });

  // === ANALYTICS ENDPOINTS ===
  
  // Get item volume analytics
  app.get("/api/analytics/volume/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      const range = req.query.range || 'week'; // day, week, month
      const now = new Date();
      let startDate: Date;
      
      switch (range) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'week':
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }
      
      const daily = await storage.getItemVolumeDaily(itemId, startDate, now);
      const weekly = await storage.getItemVolumeWeekly(itemId);
      const monthly = await storage.getItemVolumeMonthly(itemId);
      
      res.json({ daily, weekly, monthly });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch volume analytics" });
    }
  });
  
  // Get transactions for an item (for LLM training data review)
  app.get("/api/analytics/transactions/:itemId", isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid item ID" });
      }
      
      const limit = parseInt(req.query.limit as string) || 100;
      const transactions = await storage.getTransactionsByItem(itemId, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // === USER PRESENCE ENDPOINTS ===
  
  // Heartbeat - call every 30 seconds to update online status
  app.post("/api/heartbeat", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUserHeartbeat(userId);
      res.json({ status: "ok" });
    } catch (error) {
      res.status(500).json({ error: "Failed to update heartbeat" });
    }
  });

  // Get online user count (public for authenticated users)
  app.get("/api/presence/online-count", isAuthenticated, async (req: any, res) => {
    try {
      const onlineUsers = await storage.getOnlineUsers(60000); // 1 minute threshold
      res.json({ onlineCount: onlineUsers.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch online count" });
    }
  });

  // === ADMIN ENDPOINTS ===
  // Note: ADMIN_EMAILS is defined near the top of registerRoutes function
  
  // Middleware to check if user is admin
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(403).json({ error: "User not found" });
      }
      
      // Check if user email matches admin emails or has isAdmin flag
      if (!ADMIN_EMAILS.includes(user.email ?? "") && !user.isAdmin) {
        return res.status(403).json({ error: "Admin access required" });
      }
      
      next();
    } catch (error) {
      res.status(500).json({ error: "Failed to verify admin status" });
    }
  };
  
  // Check if current user is admin
  app.get("/api/admin/check", isAuthenticated, async (req: any, res) => {
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
  
  // Get all users with online/offline status
  app.get("/api/admin/users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const sessions = await storage.getAllUserSessions();
      const onlineThreshold = 60000; // 1 minute
      const now = Date.now();
      
      const usersWithStatus = allUsers.map(user => {
        const session = sessions.find(s => s.userId === user.id);
        const isOnline = session?.lastHeartbeat && 
          (now - new Date(session.lastHeartbeat).getTime()) < onlineThreshold;
        
        return {
          ...user,
          isOnline,
          lastHeartbeat: session?.lastHeartbeat,
        };
      });
      
      res.json(usersWithStatus);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  
  // Get online/offline user counts
  app.get("/api/admin/presence", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const onlineUsers = await storage.getOnlineUsers(60000); // 1 minute threshold
      
      res.json({
        totalUsers: allUsers.length,
        onlineCount: onlineUsers.length,
        offlineCount: allUsers.length - onlineUsers.length,
        onlineUsers: onlineUsers.map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          profileImageUrl: u.profileImageUrl,
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch presence data" });
    }
  });
  
  // Get platform statistics (for admin)
  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const transactions = await storage.getAllTransactions(1000);
      
      // Calculate totals
      const totalTransactions = transactions.length;
      const buyTransactions = transactions.filter(t => t.transactionType === 'buy').length;
      const sellTransactions = transactions.filter(t => t.transactionType === 'sell').length;
      const totalVolume = transactions.reduce((sum, t) => sum + (t.totalValue || 0), 0);
      const totalTaxPaid = transactions.reduce((sum, t) => sum + (t.taxPaid || 0), 0);
      
      // Get unique items traded
      const uniqueItems = new Set(transactions.map(t => t.itemId)).size;
      
      res.json({
        totalUsers: allUsers.length,
        totalTransactions,
        buyTransactions,
        sellTransactions,
        totalVolume,
        totalTaxPaid,
        uniqueItems,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch platform stats" });
    }
  });
  
  // Get all transactions (for admin review/LLM training data export)
  app.get("/api/admin/transactions", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 500;
      const transactions = await storage.getAllTransactions(limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // Backfill missing item IDs for flips
  app.post("/api/flips/backfill-item-ids", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips = await storage.getFlips(userId);
      
      // Filter flips that have no itemId
      const flipsWithoutId = flips.filter(f => !f.itemId && f.itemName);
      
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];
      
      // Process in batches with delay to avoid rate limiting
      const BATCH_SIZE = 5;
      const DELAY_MS = 500;
      
      for (let i = 0; i < flipsWithoutId.length; i += BATCH_SIZE) {
        const batch = flipsWithoutId.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (flip) => {
          try {
            const item = await getItemPrice(flip.itemName);
            if (item && item.id) {
              // Only update item metadata fields with defined values
              // Build update object with only the fields that have values
              const updateData: Record<string, unknown> = { itemId: item.id };
              
              if (item.icon !== undefined && item.icon !== null) {
                updateData.itemIcon = item.icon;
              }
              if (item.isMembers !== undefined && item.isMembers !== null) {
                updateData.isMembers = item.isMembers;
              }
              if (item.geLimit !== undefined && item.geLimit !== null) {
                updateData.geLimit = item.geLimit;
              }
              
              await storage.updateFlip(flip.id, userId, updateData as any);
              updated++;
            } else {
              failed++;
              errors.push(`Item not found: ${flip.itemName}`);
            }
          } catch (error) {
            console.error(`[backfill] Failed to lookup item: ${flip.itemName}`, error);
            failed++;
            errors.push(`Error for ${flip.itemName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }));
        
        // Add delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < flipsWithoutId.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }
      
      res.json({ 
        message: `Backfill complete`,
        total: flipsWithoutId.length,
        updated,
        failed,
        errors: errors.slice(0, 10) // Only return first 10 errors
      });
    } catch (error) {
      console.error("[backfill] Error:", error);
      res.status(500).json({ error: "Failed to backfill item IDs" });
    }
  });

  // Resolve item ID by name (for frontend fallback)
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

  // RS Accounts (Alt management) API
  app.get("/api/rs-accounts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const accounts = await storage.getRsAccounts(userId);
      res.json(accounts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch RS accounts" });
    }
  });

  app.post("/api/rs-accounts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedAccount = insertRsAccountSchema.parse(req.body);
      
      // If this is the first account, make it default
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

  app.patch("/api/rs-accounts/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/rs-accounts/:id", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/rs-accounts/:id/set-default", isAuthenticated, async (req: any, res) => {
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

  // User Profile Update API
  app.patch("/api/user/profile", isAuthenticated, async (req: any, res) => {
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

  // Avatar upload
  app.post("/api/user/avatar", isAuthenticated, upload.single("avatar"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Convert image to base64 data URL
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

  // =====================
  // RECIPE ROUTES
  // =====================

  // Get all recipes for user
  app.get("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recipes = await storage.getRecipes(userId);
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipes" });
    }
  });

  // Get single recipe with components
  app.get("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
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

  // Create recipe with components
  app.post("/api/recipes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { components, ...recipeData } = req.body;
      const validatedRecipe = insertRecipeSchema.parse(recipeData);
      
      const recipe = await storage.createRecipe(userId, validatedRecipe);
      
      // Create components if provided
      if (components && Array.isArray(components)) {
        for (const comp of components) {
          const validatedComp = insertRecipeComponentSchema.parse({
            ...comp,
            recipeId: recipe.id,
          });
          await storage.createRecipeComponent(validatedComp);
        }
      }
      
      // Return recipe with components
      const fullRecipe = await storage.getRecipeWithComponents(recipe.id);
      res.status(201).json(fullRecipe);
    } catch (error) {
      console.error("Error creating recipe:", error);
      res.status(400).json({ error: "Invalid recipe data" });
    }
  });

  // Update recipe
  app.patch("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
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

  // Delete recipe
  app.delete("/api/recipes/:id", isAuthenticated, async (req: any, res) => {
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

  // Archive recipe
  app.post("/api/recipes/:id/archive", isAuthenticated, async (req: any, res) => {
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

  // Add component to recipe
  app.post("/api/recipes/:recipeId/components", isAuthenticated, async (req: any, res) => {
    try {
      const { recipeId } = req.params;
      const validatedComp = insertRecipeComponentSchema.parse({
        ...req.body,
        recipeId,
      });
      const component = await storage.createRecipeComponent(validatedComp);
      res.status(201).json(component);
    } catch (error) {
      res.status(400).json({ error: "Invalid component data" });
    }
  });

  // Update component
  app.patch("/api/recipe-components/:id", isAuthenticated, async (req: any, res) => {
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

  // Delete component
  app.delete("/api/recipe-components/:id", isAuthenticated, async (req: any, res) => {
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

  // =====================
  // RECIPE RUN ROUTES
  // =====================

  // Get all runs for user
  app.get("/api/recipe-runs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const runs = await storage.getRecipeRuns(userId);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recipe runs" });
    }
  });

  // Get single run with details
  app.get("/api/recipe-runs/:id", isAuthenticated, async (req: any, res) => {
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

  // Start a new run
  app.post("/api/recipe-runs", isAuthenticated, async (req: any, res) => {
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

  // Update run (status, prices, etc)
  app.patch("/api/recipe-runs/:id", isAuthenticated, async (req: any, res) => {
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

  // Delete run
  app.delete("/api/recipe-runs/:id", isAuthenticated, async (req: any, res) => {
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

  // Log component purchase for a run
  app.post("/api/recipe-runs/:runId/components", isAuthenticated, async (req: any, res) => {
    try {
      const { runId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify run belongs to user
      const run = await storage.getRecipeRun(runId);
      if (!run || run.userId !== userId) {
        return res.status(404).json({ error: "Run not found" });
      }
      
      const validatedComp = insertRecipeRunComponentSchema.parse({
        ...req.body,
        runId,
        totalCost: req.body.buyPrice * req.body.quantityAcquired,
      });
      
      const component = await storage.createRecipeRunComponent(validatedComp);
      
      // Update run's total component cost
      const runComponents = await storage.getRecipeRunComponents(runId);
      const totalCost = runComponents.reduce((sum, c) => sum + c.totalCost, 0);
      await storage.updateRecipeRun(runId, userId, { totalComponentCost: totalCost });
      
      res.status(201).json(component);
    } catch (error) {
      console.error("Error logging component:", error);
      res.status(400).json({ error: "Invalid component data" });
    }
  });

  // Update run component
  app.patch("/api/recipe-run-components/:id", isAuthenticated, async (req: any, res) => {
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

  // Delete run component
  app.delete("/api/recipe-run-components/:id", isAuthenticated, async (req: any, res) => {
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

  // Complete run and create flip record
  app.post("/api/recipe-runs/:id/complete", isAuthenticated, async (req: any, res) => {
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
      
      // Calculate profit (with tax)
      const taxDetails = calculateFlipTax(actualSellPrice, totalCost, runDetails.recipe.outputQuantity);
      const profit = taxDetails.profit;
      
      // Create a flip record for stats
      const flip = await storage.createFlip(userId, {
        itemName: runDetails.recipe.outputItemName,
        itemId: runDetails.recipe.outputItemId ?? undefined,
        itemIcon: runDetails.recipe.outputItemIcon ?? undefined,
        quantity: runDetails.recipe.outputQuantity,
        buyPrice: Math.floor(totalCost / runDetails.recipe.outputQuantity), // Average cost per item
        sellPrice: actualSellPrice,
        buyDate: runDetails.startedAt || new Date(),
        sellDate: sellDate ? new Date(sellDate) : new Date(),
        strategyTag: "Other",
        membershipStatus: "Unknown",
        notes: `Crafted from recipe: ${runDetails.recipe.name}`,
        category: "Crafting",
      });
      
      // Update run status
      await storage.updateRecipeRun(id, userId, {
        status: "sold",
        actualSellPrice,
        profit,
        linkedFlipId: flip.id,
        completedAt: new Date(),
      });
      
      const updatedRun = await storage.getRecipeRunWithDetails(id);
      res.json({ run: updatedRun, flip });
    } catch (error) {
      console.error("Error completing run:", error);
      res.status(500).json({ error: "Failed to complete run" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
