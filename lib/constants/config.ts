export const SUPPORTED_CURRENCIES = [
  { code: "INR", label: "INR - Indian Rupee (₹)" },
  { code: "USD", label: "USD - US Dollar ($)" },
  { code: "EUR", label: "EUR - Euro (€)" },
  { code: "GBP", label: "GBP - British Pound (£)" },
  { code: "AUD", label: "AUD - Australian Dollar (A$)" },
  { code: "CAD", label: "CAD - Canadian Dollar (C$)" },
  { code: "SGD", label: "SGD - Singapore Dollar (S$)" },
  { code: "JPY", label: "JPY - Japanese Yen (¥)" },
];

export const DEFAULT_CURRENCY = "INR";

export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const SUPPORTED_RECEIPT_TYPES = [
  ...SUPPORTED_IMAGE_TYPES,
  "application/pdf",
];

export const ACCEPTED_FILE_ATTR = "image/jpeg,image/png,image/webp,image/gif,application/pdf";

export const MAX_PARTICIPANTS = 20;
export const MAX_ITEMS = 100;
