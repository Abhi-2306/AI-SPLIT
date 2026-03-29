import { createClient } from "@/lib/supabase/server";
import { container } from "@/composition-root/container";
import { successResponse, errorResponse, handleApiError } from "@/lib/utils/apiHelpers";

// GET /api/bills/stats — aggregate totals and user's personal share across all bills
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not authenticated", 401);

    const { data: billRows, error } = await supabase
      .from("bills")
      .select("id, currency, status, tax, tip")
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!billRows || billRows.length === 0) {
      return successResponse({ byCurrency: {} });
    }

    const billIds = billRows.map((b) => b.id);

    // Get item subtotals
    const { data: items } = await supabase
      .from("bill_items")
      .select("bill_id, unit_price, quantity")
      .in("bill_id", billIds);

    const subtotals: Record<string, number> = {};
    (items ?? []).forEach((item) => {
      subtotals[item.bill_id] =
        (subtotals[item.bill_id] ?? 0) + Number(item.unit_price) * item.quantity;
    });

    // For assigned/settled bills, run calculateSplit to get user's share
    const assignedBills = billRows.filter(
      (b) => b.status === "assigned" || b.status === "settled"
    );

    const splitResults = await Promise.allSettled(
      assignedBills.map((b) => container.calculateSplit.execute(b.id))
    );

    const myShareByCurrency: Record<string, number> = {};
    assignedBills.forEach((bill, i) => {
      const result = splitResults[i];
      if (result.status !== "fulfilled" || !result.value) return;
      const ps = result.value.participantSplits.find(
        (p) => p.participant.userId === user.id
      );
      if (!ps) return;
      myShareByCurrency[bill.currency] =
        (myShareByCurrency[bill.currency] ?? 0) + ps.total;
    });

    // Aggregate total per currency
    const totalByCurrency: Record<string, number> = {};
    billRows.forEach((b) => {
      const billTotal =
        (subtotals[b.id] ?? 0) + (Number(b.tax) || 0) + (Number(b.tip) || 0);
      totalByCurrency[b.currency] = (totalByCurrency[b.currency] ?? 0) + billTotal;
    });

    // Build response: per currency { total, myShare }
    const byCurrency: Record<string, { total: number; myShare: number }> = {};
    for (const currency of Object.keys(totalByCurrency)) {
      byCurrency[currency] = {
        total: Math.round(totalByCurrency[currency] * 100) / 100,
        myShare: Math.round((myShareByCurrency[currency] ?? 0) * 100) / 100,
      };
    }

    return successResponse({ byCurrency, billCount: billRows.length });
  } catch (error) {
    return handleApiError(error);
  }
}
