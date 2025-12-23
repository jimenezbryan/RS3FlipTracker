// RS3 Grand Exchange Tax Calculator
// Tax rules:
// - Tax rate = 2% of sell price per item
// - Tax is applied to seller, calculated per item
// - Tax amount is rounded down (floor)
// - Items sold below 50 gp per item are exempt (tax = 0)
// - Bonds are exempt (tax = 0)

export interface TaxCalculation {
  taxPerItem: number;
  totalTax: number;
  netSellPerItem: number;
  netSellTotal: number;
  grossSellTotal: number;
  profit: number;
  profitPerItem: number;
  roi: number;
  isTaxExempt: boolean;
  exemptReason?: string;
}

// Known Bond item IDs in RS3
const BOND_ITEM_IDS = [
  29492, // Bond
  43998, // Premier Club bond
];

export function isBondItem(itemId: number | undefined | null): boolean {
  if (!itemId) return false;
  return BOND_ITEM_IDS.includes(itemId);
}

export function isTaxExempt(
  sellPrice: number,
  itemId?: number | null,
  itemName?: string
): { exempt: boolean; reason?: string } {
  // Check for Bond by ID
  if (itemId && isBondItem(itemId)) {
    return { exempt: true, reason: "Bonds are tax exempt" };
  }
  
  // Check for Bond by name (fallback)
  if (itemName && itemName.toLowerCase().includes("bond")) {
    return { exempt: true, reason: "Bonds are tax exempt" };
  }
  
  // Items below 50 gp are exempt
  if (sellPrice < 50) {
    return { exempt: true, reason: "Items below 50 gp are tax exempt" };
  }
  
  return { exempt: false };
}

export function calculateTaxPerItem(
  sellPrice: number,
  itemId?: number | null,
  itemName?: string
): number {
  const exemption = isTaxExempt(sellPrice, itemId, itemName);
  if (exemption.exempt) {
    return 0;
  }
  
  // 2% tax, floored per item
  return Math.floor(sellPrice * 0.02);
}

export function calculateFlipTax(
  sellPrice: number,
  buyPrice: number,
  quantity: number = 1,
  itemId?: number | null,
  itemName?: string
): TaxCalculation {
  const exemption = isTaxExempt(sellPrice, itemId, itemName);
  
  const taxPerItem = exemption.exempt ? 0 : Math.floor(sellPrice * 0.02);
  const totalTax = taxPerItem * quantity;
  const netSellPerItem = sellPrice - taxPerItem;
  const netSellTotal = netSellPerItem * quantity;
  const grossSellTotal = sellPrice * quantity;
  const totalBuyCost = buyPrice * quantity;
  const profit = netSellTotal - totalBuyCost;
  const profitPerItem = profit / quantity;
  const roi = totalBuyCost > 0 ? ((profit / totalBuyCost) * 100) : 0;
  
  return {
    taxPerItem,
    totalTax,
    netSellPerItem,
    netSellTotal,
    grossSellTotal,
    profit,
    profitPerItem,
    roi: Math.round(roi * 100) / 100,
    isTaxExempt: exemption.exempt,
    exemptReason: exemption.reason,
  };
}

export function formatGp(value: number): string {
  if (Math.abs(value) >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}
