/**
 * Parses GP (gold piece) values with shorthand notation
 * Supports: k/K (thousands), m/M (millions), b/B (billions)
 * Examples: "4.3b" -> 4300000000, "500k" -> 500000, "1.5m" -> 1500000
 */
export function parseGp(value: string): number | null {
  if (!value || typeof value !== 'string') {
    return null;
  }
  
  // Remove commas and whitespace
  const cleaned = value.replace(/,/g, '').replace(/\s/g, '').toLowerCase();
  
  if (!cleaned) {
    return null;
  }
  
  // Check for suffix
  const suffixMatch = cleaned.match(/^([\d.]+)([kmb])?$/);
  
  if (!suffixMatch) {
    // Try parsing as plain number
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : Math.floor(num);
  }
  
  const [, numPart, suffix] = suffixMatch;
  const baseNum = parseFloat(numPart);
  
  if (isNaN(baseNum)) {
    return null;
  }
  
  let multiplier = 1;
  switch (suffix) {
    case 'k':
      multiplier = 1000;
      break;
    case 'm':
      multiplier = 1000000;
      break;
    case 'b':
      multiplier = 1000000000;
      break;
  }
  
  return Math.floor(baseNum * multiplier);
}

/**
 * Formats a GP value with appropriate suffix for display
 * Examples: 4300000000 -> "4.3B", 500000 -> "500K"
 */
export function formatGpShorthand(value: number): string {
  if (value >= 1000000000) {
    const billions = value / 1000000000;
    return billions % 1 === 0 ? `${billions}B` : `${billions.toFixed(2).replace(/\.?0+$/, '')}B`;
  } else if (value >= 1000000) {
    const millions = value / 1000000;
    return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(2).replace(/\.?0+$/, '')}M`;
  } else if (value >= 1000) {
    const thousands = value / 1000;
    return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1).replace(/\.?0+$/, '')}K`;
  }
  return value.toLocaleString();
}
