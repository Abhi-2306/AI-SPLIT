import type { Money } from "../../domain/value-objects/Money";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  CNY: "¥",
  SGD: "S$",
  MYR: "RM",
};

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * Formats a money amount for display. Shows exact floating-point value.
 */
export function formatMoney(money: Money): string {
  const symbol = getCurrencySymbol(money.currency);
  return `${symbol}${money.amount.toFixed(2)}`;
}

/**
 * Formats a raw number amount with a currency, rounded to 2 decimal places.
 */
export function formatAmount(amount: number, currency: string): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toFixed(2)}`;
}
