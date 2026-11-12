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
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  // Number(toFixed) drops trailing zeros: 2.50 -> 2.5, 3.00 -> 3
  if (abs >= 1000000000) return `${sign}${Number((abs / 1000000000).toFixed(2))}B`;
  if (abs >= 1000000) return `${sign}${Number((abs / 1000000).toFixed(2))}M`;
  if (abs >= 1000) return `${sign}${Number((abs / 1000).toFixed(1))}K`;
  return value.toLocaleString();
}
