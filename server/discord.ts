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
      title: `📊 ${flip.itemName}`,
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
        text: "RS3 Flip Tracker",
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
