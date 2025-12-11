import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFlipSchema } from "@shared/schema";
import { getItemPrice, searchItems, getItemTrend } from "./ge-api";
import { extractFlipData } from "./ocr";

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.get("/api/flips", async (_req, res) => {
    try {
      const flips = await storage.getFlips();
      res.json(flips);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch flips" });
    }
  });

  app.post("/api/flips", async (req, res) => {
    try {
      const validatedFlip = insertFlipSchema.parse(req.body);
      const newFlip = await storage.createFlip(validatedFlip);
      res.status(201).json(newFlip);
    } catch (error) {
      res.status(400).json({ error: "Invalid flip data" });
    }
  });

  app.patch("/api/flips/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedFlip = insertFlipSchema.partial().parse(req.body);
      const updatedFlip = await storage.updateFlip(id, validatedFlip);
      
      if (!updatedFlip) {
        return res.status(404).json({ error: "Flip not found" });
      }
      
      res.json(updatedFlip);
    } catch (error) {
      res.status(400).json({ error: "Invalid flip data" });
    }
  });

  app.delete("/api/flips/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteFlip(id);
      
      if (!success) {
        return res.status(404).json({ error: "Flip not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete flip" });
    }
  });

  app.post("/api/flips/ocr", async (req, res) => {
    try {
      const { image } = req.body;
      
      if (!image || typeof image !== "string") {
        return res.status(400).json({ error: "Image data required" });
      }
      
      const extractedData = await extractFlipData(image);
      res.json(extractedData);
    } catch (error) {
      console.error("OCR error:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
