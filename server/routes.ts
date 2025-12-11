import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFlipSchema, insertWatchlistSchema, insertPriceAlertSchema } from "@shared/schema";
import { getItemPrice, searchItems, getItemTrend } from "./ge-api";
import { setupAuth, isAuthenticated } from "./replitAuth";

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
      const success = await storage.deleteFlip(id, userId);
      
      if (!success) {
        return res.status(404).json({ error: "Flip not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete flip" });
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

  const httpServer = createServer(app);

  return httpServer;
}
