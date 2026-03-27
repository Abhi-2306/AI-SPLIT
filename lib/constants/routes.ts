export const ROUTES = {
  home: "/",
  profile: "/profile",
  friends: "/friends",
  groups: "/groups",
  newBill: "/bills/new",
  bill: (billId: string) => `/bills/${billId}`,
  billSummary: (billId: string) => `/bills/${billId}/summary`,
} as const;
