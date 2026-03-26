import type { IBillRepository } from "../../domain/repositories/IBillRepository";
import type { Bill, BillStatus } from "../../domain/entities/Bill";
import { computeBillTotals } from "../../domain/entities/Bill";
import type { BillItem, ItemSplitConfig } from "../../domain/entities/BillItem";
import { createBillItem } from "../../domain/entities/BillItem";
import type { Participant } from "../../domain/entities/Participant";
import type { Assignment } from "../../domain/entities/Assignment";
import type { BillId } from "../../domain/value-objects/BrandedIds";
import {
  asBillId,
  asBillItemId,
  asParticipantId,
  asAssignmentId,
} from "../../domain/value-objects/BrandedIds";
import { createMoney } from "../../domain/value-objects/Money";
import { createClient } from "../../lib/supabase/server";

export class SupabaseBillRepository implements IBillRepository {
  async findById(id: BillId): Promise<Bill | null> {
    const supabase = await createClient();

    const { data: billRow, error } = await supabase
      .from("bills")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !billRow) return null;

    const [itemsResult, participantsResult, assignmentsResult] =
      await Promise.all([
        supabase.from("bill_items").select("*").eq("bill_id", id),
        supabase.from("participants").select("*").eq("bill_id", id),
        supabase.from("assignments").select("*").eq("bill_id", id),
      ]);

    const items: BillItem[] = (itemsResult.data ?? []).map((row) => {
      const splitConfig: ItemSplitConfig | null = row.split_config
        ? {
            mode: row.split_config.mode,
            entries: row.split_config.entries.map(
              (e: { participantId: string; value: number }) => ({
                participantId: asParticipantId(e.participantId),
                value: e.value,
              })
            ),
          }
        : null;
      return createBillItem(
        asBillItemId(row.id),
        row.name,
        row.quantity,
        createMoney(Number(row.unit_price), billRow.currency),
        row.notes ?? null,
        splitConfig
      );
    });

    const participants: Participant[] = (participantsResult.data ?? []).map(
      (row) => ({
        id: asParticipantId(row.id),
        name: row.name,
        createdAt: new Date(row.created_at),
      })
    );

    const assignments: Assignment[] = (assignmentsResult.data ?? []).map(
      (row) => ({
        id: asAssignmentId(row.id),
        billItemId: asBillItemId(row.bill_item_id),
        participantId: asParticipantId(row.participant_id),
        unitIndex: row.unit_index,
      })
    );

    const tax =
      billRow.tax !== null && billRow.tax !== undefined
        ? createMoney(Number(billRow.tax), billRow.currency)
        : null;
    const tip =
      billRow.tip !== null && billRow.tip !== undefined
        ? createMoney(Number(billRow.tip), billRow.currency)
        : null;
    const { subtotal, total } = computeBillTotals(
      items,
      billRow.currency,
      tax,
      tip
    );

    return {
      id: asBillId(billRow.id),
      title: billRow.title,
      currency: billRow.currency,
      items,
      participants,
      assignments,
      subtotal,
      tax,
      tip,
      total,
      status: billRow.status as BillStatus,
      paidByParticipantId: billRow.paid_by_participant_id
        ? asParticipantId(billRow.paid_by_participant_id)
        : null,
      createdAt: new Date(billRow.created_at),
      updatedAt: new Date(billRow.updated_at),
    };
  }

  async save(bill: Bill): Promise<void> {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized: no active session");

    // 1. Upsert the bill row
    const { error: billError } = await supabase.from("bills").upsert({
      id: bill.id,
      user_id: user.id,
      title: bill.title,
      currency: bill.currency,
      status: bill.status,
      paid_by_participant_id: bill.paidByParticipantId ?? null,
      tax: bill.tax?.amount ?? null,
      tip: bill.tip?.amount ?? null,
      created_at: bill.createdAt.toISOString(),
      updated_at: bill.updatedAt.toISOString(),
    });
    if (billError) throw billError;

    // 2. Upsert bill_items — safe for concurrent saves: existing rows are updated in-place,
    //    new rows are inserted. No delete+reinsert race condition.
    const itemRows = bill.items.map((item) => ({
      id: item.id,
      bill_id: bill.id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice.amount,
      notes: item.notes,
      split_config: item.splitConfig
        ? {
            mode: item.splitConfig.mode,
            entries: item.splitConfig.entries.map((e) => ({
              participantId: e.participantId,
              value: e.value,
            })),
          }
        : null,
    }));
    if (itemRows.length > 0) {
      const { error } = await supabase
        .from("bill_items")
        .upsert(itemRows, { onConflict: "id" });
      if (error) throw error;
    }

    // 3. Delete orphan items (in DB but not in current bill state)
    //    Cascade on bill_item_id FK deletes their assignments automatically.
    const itemIds = bill.items.map((i) => i.id);
    if (itemIds.length > 0) {
      await supabase
        .from("bill_items")
        .delete()
        .eq("bill_id", bill.id)
        .not("id", "in", `(${itemIds.join(",")})`);
    } else {
      await supabase.from("bill_items").delete().eq("bill_id", bill.id);
    }

    // 4. Upsert participants
    const participantRows = bill.participants.map((p) => ({
      id: p.id,
      bill_id: bill.id,
      name: p.name,
      created_at: p.createdAt.toISOString(),
    }));
    if (participantRows.length > 0) {
      const { error } = await supabase
        .from("participants")
        .upsert(participantRows, { onConflict: "id" });
      if (error) throw error;
    }

    // 5. Delete orphan participants
    const participantIds = bill.participants.map((p) => p.id);
    if (participantIds.length > 0) {
      await supabase
        .from("participants")
        .delete()
        .eq("bill_id", bill.id)
        .not("id", "in", `(${participantIds.join(",")})`);
    } else {
      await supabase.from("participants").delete().eq("bill_id", bill.id);
    }

    // 6. Sync assignments: upsert current, delete orphans.
    //    Assignments are short-lived and low-volume so this is safe.
    if (bill.assignments.length > 0) {
      const { error } = await supabase
        .from("assignments")
        .upsert(
          bill.assignments.map((a) => ({
            id: a.id,
            bill_id: bill.id,
            bill_item_id: a.billItemId,
            participant_id: a.participantId,
            unit_index: a.unitIndex,
          })),
          { onConflict: "id" }
        );
      if (error) throw error;
    }
    const assignmentIds = bill.assignments.map((a) => a.id);
    if (assignmentIds.length > 0) {
      await supabase
        .from("assignments")
        .delete()
        .eq("bill_id", bill.id)
        .not("id", "in", `(${assignmentIds.join(",")})`);
    } else {
      await supabase.from("assignments").delete().eq("bill_id", bill.id);
    }
  }

  async delete(id: BillId): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("bills").delete().eq("id", id);
    if (error) throw error;
  }
}
