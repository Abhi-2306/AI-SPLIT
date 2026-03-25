/**
 * Money value object using floating-point numbers.
 * Exact amounts are preserved and displayed as-is (no rounding).
 */
export type Money = {
  readonly amount: number;
  readonly currency: string;
};

export function createMoney(amount: number, currency: string): Money {
  return { amount, currency };
}

export function addMoney(a: Money, b: Money): Money {
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function multiplyMoney(m: Money, factor: number): Money {
  return { amount: m.amount * factor, currency: m.currency };
}

export function divideMoney(m: Money, divisor: number): Money {
  return { amount: m.amount / divisor, currency: m.currency };
}

export function zeroMoney(currency: string): Money {
  return { amount: 0, currency };
}

/**
 * Formats money for display. Shows exact value with no rounding.
 * Uses currency symbol mapping for common currencies.
 */
export function formatMoney(m: Money): string {
  const symbols: Record<string, string> = {
    USD: "$",
    INR: "₹",
    EUR: "€",
    GBP: "£",
    AUD: "A$",
    CAD: "C$",
    JPY: "¥",
    CNY: "¥",
  };
  const symbol = symbols[m.currency] ?? m.currency + " ";

  // Display exact value. Remove unnecessary trailing zeros after decimal.
  const formatted = m.amount % 1 === 0
    ? m.amount.toString()
    : m.amount.toString();

  return `${symbol}${formatted}`;
}
