import type { Flip } from "@shared/schema";
import { formatGpShorthand } from "@shared/gpParser";

interface DiscordEmbed {
  title: string;
  color: number;
  fields: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
  footer?: { text: string };
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
