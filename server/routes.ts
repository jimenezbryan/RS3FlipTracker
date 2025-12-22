import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { insertFlipSchema, insertWatchlistSchema, insertPriceAlertSchema, insertFavoriteSchema, insertProfitGoalSchema, insertPortfolioCategorySchema, insertPortfolioHoldingSchema } from "@shared/schema";
import { getItemPrice, searchItems, getItemTrend, getItemPriceHistory, getItemSuggestions } from "./ge-api";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { processScreenshot, matchItemsToGE } from "./ocr";
import { analyzeRS3Screenshot } from "./ai-vision";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

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
      
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  app.get("/api/flips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const flips = await storage.getFlips(userId);
      res.json(flips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flips" });
    }
  });

  app.post("/api/flips", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedFlip = insertFlipSchema.parse(req.body);
      const newFlip = await storage.createFlip(userId, validatedFlip);
      res.status(201).json(newFlip);
    } catch (error) {
      res.status(400).json({ error: "Invalid flip data" });
    }
  });

  app.patch("/api/flips/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const validatedFlip = insertFlipSchema.partial().parse(req.body);
      const updatedFlip = await storage.updateFlip(id, userId, validatedFlip);
      
      if (!updatedFlip) {
        return res.status(404).json({ error: "Flip not found" });
      }
      
      res.json(updatedFlip);
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
      const validatedHolding = insertPortfolioHoldingSchema.partial().parse(req.body);
      const updatedHolding = await storage.updatePortfolioHolding(id, userId, validatedHolding);
      
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
      const holdingsWithValues: Array<typeof holdings[0] & { currentPrice: number; value: number; profit: number; profitPercent: number }> = [];

      for (const holding of holdings) {
        let currentPrice = holding.lastValuedPrice || holding.avgBuyPrice;
        
        const value = currentPrice * holding.quantity;
        const cost = holding.avgBuyPrice * holding.quantity;
        totalValue += value;
        totalCost += cost;

        holdingsWithValues.push({
          ...holding,
          currentPrice,
          value,
          profit: value - cost,
          profitPercent: cost > 0 ? ((value - cost) / cost) * 100 : 0,
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
        holdingCount: holdings.length,
        holdings: holdingsWithValues,
        categories: categoryBreakdown,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch portfolio summary" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
