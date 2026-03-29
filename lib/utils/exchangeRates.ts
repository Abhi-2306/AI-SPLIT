/**
 * Convert an amount from one currency to another using rates relative to USD.
 * rates["INR"] = 83.5 means 1 USD = 83.5 INR
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  const fromRate = rates[from] ?? 1;
  const toRate = rates[to] ?? 1;
  // Convert: amount in `from` → USD → `to`
  const inUsd = amount / fromRate;
  return Math.round(inUsd * toRate * 100) / 100;
}
