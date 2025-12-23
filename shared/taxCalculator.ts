// RS3 Grand Exchange Tax Calculator
// Tax rules:
// - Tax rate = 2% of sell price per item
// - Tax is applied to seller, calculated per item
// - Tax amount is rounded down (floor)
// - Maximum tax per transaction is capped at 5,000,000 gp
// - Items sold for 49 gp or less per item are exempt (tax = 0)
// - Bonds are exempt (tax = 0)

const GE_TAX_RATE = 0.02;
const GE_TAX_CAP = 5_000_000;

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
  
  // Items sold for 49 gp or less are exempt
  if (sellPrice <= 49) {
    return { exempt: true, reason: "Items sold for 49 gp or less are tax exempt" };
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
  return Math.floor(sellPrice * GE_TAX_RATE);
}

export function calculateFlipTax(
  sellPrice: number,
  buyPrice: number,
  quantity: number = 1,
  itemId?: number | null,
  itemName?: string
): TaxCalculation {
  const exemption = isTaxExempt(sellPrice, itemId, itemName);
  
  // Calculate per-item tax (floored)
  const taxPerItem = exemption.exempt ? 0 : Math.floor(sellPrice * GE_TAX_RATE);
  
  // Calculate total tax with 5M cap
  const rawTotalTax = taxPerItem * quantity;
  const totalTax = Math.min(rawTotalTax, GE_TAX_CAP);
  
  // If cap is applied, recalculate effective per-item values
  const effectiveTaxPerItem = quantity > 0 ? totalTax / quantity : 0;
  const netSellPerItem = sellPrice - effectiveTaxPerItem;
  const netSellTotal = (sellPrice * quantity) - totalTax;
  const grossSellTotal = sellPrice * quantity;
  const totalBuyCost = buyPrice * quantity;
  const profit = netSellTotal - totalBuyCost;
  const profitPerItem = quantity > 0 ? profit / quantity : 0;
  const roi = totalBuyCost > 0 ? ((profit / totalBuyCost) * 100) : 0;
  
  return {
    taxPerItem: effectiveTaxPerItem,
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
