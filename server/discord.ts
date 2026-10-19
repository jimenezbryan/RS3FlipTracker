import type { Flip } from "@shared/schema";
import { formatGpShorthand } from "@shared/gpParser";
import type { IStorage } from "./storage";
import type { ScoredItem } from "@shared/scannerPipeline";
import { buildOutOfRangeEmbed, type EmbedHit } from "@shared/outOfRangeEmbed";

interface DiscordEmbed {
  title: string;
  color: number;
  url?: string;
  description?: string;
  fields: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
  footer?: { text: string };
  thumbnail?: { url: string };
  image?: { url: string };
}

interface DiscordWebhookPayload {
  embeds: DiscordEmbed[];
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusAndColor(flip: Flip): { status: string; color: number } {
  if (!flip.sellDate) {
    return { status: "🟡 Open Position", color: 0xf59e0b };
  }
  
  const buyTotal = Number(flip.buyPrice) * flip.quantity;
  const sellTotal = Number(flip.sellPrice || 0) * flip.quantity;
  const taxPerItem = Math.floor(Number(flip.sellPrice || 0) * 0.02);
  const totalTax = taxPerItem * flip.quantity;
  const profit = sellTotal - buyTotal - totalTax;
  
  if (profit > 0) {
    return { status: "🟢 Profitable", color: 0x22c55e };
  } else if (profit < 0) {
    return { status: "🔴 Loss", color: 0xef4444 };
  }
  return { status: "⚪ Break Even", color: 0x6b7280 };
}

export async function sendFlipToDiscord(flip: Flip): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log("[Discord] DISCORD_WEBHOOK_URL not configured, skipping notification");
    return false;
  }

  try {
    const { status, color } = getStatusAndColor(flip);
    
    const embed: DiscordEmbed = {
      title: `📊 New Flip: ${flip.itemName}`,
      color,
      fields: [
        {
          name: "Buy Price",
          value: `${formatGpShorthand(Number(flip.buyPrice))} gp`,
          inline: true,
        },
        {
          name: "Sell Price",
          value: flip.sellPrice ? `${formatGpShorthand(Number(flip.sellPrice))} gp` : "—",
          inline: true,
        },
        {
          name: "Quantity",
          value: flip.quantity.toLocaleString(),
          inline: true,
        },
        {
          name: "Buy Date",
          value: formatDate(flip.buyDate),
          inline: true,
        },
        {
          name: "Sell Date",
          value: formatDate(flip.sellDate),
          inline: true,
        },
        {
          name: "Status",
          value: status,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "FlipSync",
      },
    };

    const payload: DiscordWebhookPayload = {
      embeds: [embed],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Discord] Webhook failed:", response.status, errorText);
      return false;
    }

    console.log("[Discord] Flip shared successfully:", flip.itemName);
    return true;
  } catch (error) {
    console.error("[Discord] Error sending webhook:", error);
    return false;
  }
}

export async function sendFlipUpdateToDiscord(oldFlip: Flip, newFlip: Flip): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log("[Discord] DISCORD_WEBHOOK_URL not configured, skipping notification");
    return false;
  }

  try {
    const changes: { name: string; value: string; inline?: boolean }[] = [];
    
    // Detect what changed
    if (Number(oldFlip.buyPrice) !== Number(newFlip.buyPrice)) {
      changes.push({
        name: "Buy Price",
        value: `${formatGpShorthand(Number(oldFlip.buyPrice))} → ${formatGpShorthand(Number(newFlip.buyPrice))} gp`,
        inline: true,
      });
    }
    
    if (Number(oldFlip.sellPrice || 0) !== Number(newFlip.sellPrice || 0)) {
      const wasCompleted = !oldFlip.sellPrice && newFlip.sellPrice;
      changes.push({
        name: wasCompleted ? "Sell Price (COMPLETED)" : "Sell Price",
        value: `${oldFlip.sellPrice ? formatGpShorthand(Number(oldFlip.sellPrice)) : "—"} → ${newFlip.sellPrice ? formatGpShorthand(Number(newFlip.sellPrice)) : "—"} gp`,
        inline: true,
      });
    }
    
    if (oldFlip.quantity !== newFlip.quantity) {
      changes.push({
        name: "Quantity",
        value: `${oldFlip.quantity.toLocaleString()} → ${newFlip.quantity.toLocaleString()}`,
        inline: true,
      });
    }
    
    if (oldFlip.strategyTag !== newFlip.strategyTag) {
      changes.push({
        name: "Strategy",
        value: `${oldFlip.strategyTag || "None"} → ${newFlip.strategyTag || "None"}`,
        inline: true,
      });
    }
    
    if (oldFlip.notes !== newFlip.notes) {
      changes.push({
        name: "Notes",
        value: newFlip.notes ? (newFlip.notes.length > 50 ? newFlip.notes.substring(0, 47) + "..." : newFlip.notes) : "Removed",
        inline: false,
      });
    }
    
    // If no changes detected, don't send
    if (changes.length === 0) {
      console.log("[Discord] No changes detected, skipping update notification");
      return false;
    }
    
    const { status, color } = getStatusAndColor(newFlip);
    
    // Calculate profit if completed
    let profitField: { name: string; value: string; inline?: boolean } | null = null;
    if (newFlip.sellPrice && newFlip.sellDate) {
      const buyTotal = Number(newFlip.buyPrice) * newFlip.quantity;
      const sellTotal = Number(newFlip.sellPrice) * newFlip.quantity;
      const taxPerItem = Math.floor(Number(newFlip.sellPrice) * 0.02);
      const totalTax = taxPerItem * newFlip.quantity;
      const profit = sellTotal - buyTotal - totalTax;
      const roi = buyTotal > 0 ? ((profit / buyTotal) * 100).toFixed(1) : "0";
      
      profitField = {
        name: profit >= 0 ? "💰 Profit" : "📉 Loss",
        value: `${formatGpShorthand(Math.abs(profit))} gp (${roi}% ROI)`,
        inline: true,
      };
    }
    
    const embed: DiscordEmbed = {
      title: `✏️ Updated: ${newFlip.itemName}`,
      color,
      fields: [
        ...changes,
        {
          name: "Current Status",
          value: status,
          inline: true,
        },
        ...(profitField ? [profitField] : []),
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: "FlipSync",
      },
    };

    const payload: DiscordWebhookPayload = {
      embeds: [embed],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Discord] Webhook failed:", response.status, errorText);
      return false;
    }

    console.log("[Discord] Flip update shared successfully:", newFlip.itemName, `(${changes.length} changes)`);
    return true;
  } catch (error) {
    console.error("[Discord] Error sending webhook:", error);
    return false;
  }
}

export async function sendDailySummaryToDiscord(userId: string, storage: IStorage): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    const flips = await storage.getFlips(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysFlips = flips.filter(f => {
      if (!f.sellDate) return false;
      const sellDate = new Date(f.sellDate);
      sellDate.setHours(0, 0, 0, 0);
      return sellDate.getTime() === today.getTime();
    });

    const todaysOpened = flips.filter(f => {
      const buyDate = new Date(f.buyDate);
      buyDate.setHours(0, 0, 0, 0);
      return buyDate.getTime() === today.getTime();
    });

    let totalProfit = 0;
    let wins = 0;
    let losses = 0;
    let bestTrade: { name: string; profit: number } | null = null;
    let worstTrade: { name: string; profit: number } | null = null;

    for (const flip of todaysFlips) {
      if (flip.sellPrice) {
        const taxPerItem = flip.sellPrice > 49 ? Math.floor(Number(flip.sellPrice) * 0.02) : 0;
        const totalTax = taxPerItem * flip.quantity;
        const profit = (Number(flip.sellPrice) * flip.quantity) - (Number(flip.buyPrice) * flip.quantity) - totalTax;
        totalProfit += profit;

        if (profit > 0) wins++;
        else losses++;

        if (!bestTrade || profit > bestTrade.profit) {
          bestTrade = { name: flip.itemName, profit };
        }
        if (!worstTrade || profit < worstTrade.profit) {
          worstTrade = { name: flip.itemName, profit };
        }
      }
    }

    const winRate = todaysFlips.length > 0 ? (wins / todaysFlips.length * 100) : 0;

    const embed: DiscordEmbed = {
      title: "Daily Trading Summary",
      color: totalProfit >= 0 ? 0x10b981 : 0xef4444,
      fields: [
        { name: "Net P&L", value: `${totalProfit >= 0 ? '+' : ''}${formatGpShorthand(totalProfit)} gp`, inline: true },
        { name: "Trades Completed", value: `${todaysFlips.length}`, inline: true },
        { name: "Win Rate", value: `${winRate.toFixed(0)}%`, inline: true },
        { name: "Wins / Losses", value: `${wins}W / ${losses}L`, inline: true },
        { name: "Positions Opened", value: `${todaysOpened.length}`, inline: true },
        ...(bestTrade ? [{ name: "Best Trade", value: `${bestTrade.name}: +${formatGpShorthand(bestTrade.profit)} gp`, inline: false }] : []),
        ...(worstTrade && worstTrade.profit < 0 ? [{ name: "Worst Trade", value: `${worstTrade.name}: ${formatGpShorthand(worstTrade.profit)} gp`, inline: false }] : []),
      ],
      footer: { text: `FlipSync Daily Summary - ${new Date().toLocaleDateString()}` },
      timestamp: new Date().toISOString(),
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    return true;
  } catch (error) {
    console.error("[Discord] Daily summary error:", error);
    return false;
  }
}

export interface GoalAchievement {
  goalType: "daily" | "weekly" | "monthly";
  targetAmount: number;
  currentProfit: number;
  username: string;
  isFirstLoad?: boolean;
}

export async function sendGoalAchievementToDiscord(achievement: GoalAchievement): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log("[Discord] DISCORD_WEBHOOK_URL not configured, skipping goal notification");
    return false;
  }

  try {
    const goalTypeEmoji = {
      daily: "🌅",
      weekly: "📅", 
      monthly: "🗓️"
    };
    
    const goalTypeLabel = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly"
    };

    const title = achievement.isFirstLoad
      ? `📊 ${goalTypeLabel[achievement.goalType]} Goal Status ${goalTypeEmoji[achievement.goalType]}`
      : `🎉 Goal Achieved! ${goalTypeEmoji[achievement.goalType]}`;
    
    const footerText = achievement.isFirstLoad
      ? "FlipSync - Already crushing it! 💪"
      : "FlipSync - Congratulations! 🏆";

    const embed: DiscordEmbed = {
      title,
      color: achievement.isFirstLoad ? 0x3498db : 0xffd700, // Blue for status, Gold for real-time
      fields: [
        {
          name: "Trader",
          value: achievement.username,
          inline: true,
        },
        {
          name: "Goal Type",
          value: `${goalTypeLabel[achievement.goalType]} Goal`,
          inline: true,
        },
        {
          name: "Target",
          value: `${formatGpShorthand(achievement.targetAmount)} gp`,
          inline: true,
        },
        {
          name: "Current Profit",
          value: `${formatGpShorthand(achievement.currentProfit)} gp`,
          inline: true,
        },
        {
          name: "Progress",
          value: `${Math.round((achievement.currentProfit / achievement.targetAmount) * 100)}%`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: footerText,
      },
    };

    const payload: DiscordWebhookPayload = {
      embeds: [embed],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Discord] Goal achievement webhook failed:", response.status, errorText);
      return false;
    }

    console.log("[Discord] Goal achievement shared:", achievement.goalType, achievement.username);
    return true;
  } catch (error) {
    console.error("[Discord] Error sending goal achievement webhook:", error);
    return false;
  }
}

/** One webhook POST carrying up to 10 embeds. The four older senders each inline this; new
 *  senders go through here. */
export async function postEmbeds(webhookUrl: string, embeds: DiscordEmbed[]): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds } satisfies DiscordWebhookPayload),
    });
    if (!response.ok) {
      console.error("[Discord] Webhook failed:", response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[Discord] Error sending webhook:", error);
    return false;
  }
}

export const postEmbed = (webhookUrl: string, embed: DiscordEmbed) => postEmbeds(webhookUrl, [embed]);

const pct = (n: number) => `${n.toFixed(1)}%`;

/**
 * A Scanner alert: one line per item, in the preset's own order. `items` is already capped by
 * the caller; `totalCount` is the uncapped size so the footer can say "+N more".
 */
export async function sendScannerAlertToDiscord(
  webhookUrl: string | null | undefined,
  presetName: string,
  mode: "new" | "summary",
  items: ScoredItem[],
  totalCount: number,
): Promise<boolean> {
  const url = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.log("[Discord] No webhook for scanner alert, skipping:", presetName);
    return false;
  }

  const lines = items.map(
    (i) =>
      `**${i.name}** · ${formatGpShorthand(i.buyPrice)} → ${formatGpShorthand(i.sellPrice)} · ` +
      `${i.margin >= 0 ? "+" : ""}${formatGpShorthand(i.margin)}/u · ROI ${pct(i.roi)} · ` +
      `score ${i.tradeScore} · vol ${formatGpShorthand(i.volume)}`,
  );
  const more = totalCount - items.length;
  if (more > 0) lines.push(`…and ${more} more`);

  const embed: DiscordEmbed = {
    title: mode === "new" ? `🔔 ${presetName}: ${totalCount} new` : `📋 ${presetName}: top ${items.length} of ${totalCount}`,
    color: mode === "new" ? 0xf59e0b : 0x3b82f6,
    // Discord caps description at 4096 chars; 25 lines of ~80 fits with room to spare.
    description: lines.join("\n").slice(0, 4000),
    fields: [],
    timestamp: new Date().toISOString(),
    footer: { text: "RS3 Flip Tracker · Scanner alert" },
  };
  return postEmbed(url, embed);
}

/** One message, one embed per hit. The caller caps `hits` (Discord allows 10 embeds). */
export async function sendOutOfRangeAlertsToDiscord(hits: EmbedHit[]): Promise<boolean> {
  const url = process.env.DISCORD_OUT_OF_RANGE_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (!url) {
    console.log("[Discord] No DISCORD_WEBHOOK_URL, skipping out-of-range alert");
    return false;
  }
  if (hits.length === 0) return false;
  const now = Date.now();
  return postEmbeds(url, hits.map((h) => buildOutOfRangeEmbed(h, now)));
}
