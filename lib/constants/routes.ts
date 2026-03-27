export const ROUTES = {
  home: "/",
  friends: "/friends",
  newBill: "/bills/new",
  bill: (billId: string) => `/bills/${billId}`,
  billSummary: (billId: string) => `/bills/${billId}/summary`,
} as const;
