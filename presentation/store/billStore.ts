"use client";

import { create } from "zustand";
import type { BillDto, SplitResultDto, OcrResultDto } from "@/application/dtos/index";

type BillState = {
  currentBill: BillDto | null;
  splitResult: SplitResultDto | null;
  ocrResult: OcrResultDto | null;

  // Bill CRUD
  createBill: (title: string, currency: string) => Promise<BillDto>;
  loadBill: (billId: string) => Promise<void>;
  updateBillMeta: (billId: string, data: { title?: string; tax?: number | null; discount?: number | null; tip?: number | null; paidByParticipantId?: string | null }) => Promise<void>;
  setItemSplitConfig: (billId: string, itemId: string, splitConfig: { mode: string; entries: Array<{ participantId: string; value: number }> } | null) => Promise<void>;

  // Items
  addItem: (billId: string, item: { name: string; quantity: number; unitPrice: number; notes?: string }) => Promise<void>;
  batchAddItems: (billId: string, items: Array<{ name: string; quantity: number; unitPrice: number; notes?: string }>) => Promise<void>;
  updateItem: (billId: string, itemId: string, patch: { name?: string; quantity?: number; unitPrice?: number; notes?: string | null }) => Promise<void>;
  deleteItem: (billId: string, itemId: string) => Promise<void>;

  // Participants
  addParticipant: (billId: string, name: string, userId?: string | null) => Promise<void>;
  updateParticipant: (billId: string, participantId: string, name: string) => Promise<void>;
  removeParticipant: (billId: string, participantId: string) => Promise<void>;

  // Assignments
  assignUnit: (billId: string, itemId: string, participantId: string, unitIndex: number) => Promise<void>;
  unassignUnit: (billId: string, itemId: string, participantId: string, unitIndex: number) => Promise<void>;

  // Split
  calculateSplit: (billId: string) => Promise<void>;

  // OCR
  uploadReceiptOcr: (billId: string, file: File) => Promise<void>;
  clearOcrResult: () => void;
};

/**
 * Merges a freshly-fetched bill into state while:
 *  1. Preserving the stable display order of items that already exist.
 *  2. Keeping any in-flight optimistic (temp-*) assignments that the server
 *     hasn't confirmed yet — so a concurrent `setItemSplitConfig` reload
 *     doesn't wipe out a `assignUnit` that is still awaiting its API response.
 */
function withStableItemOrder(existingBill: BillDto | null, freshBill: BillDto): BillDto {
  if (!existingBill) return freshBill;
  const freshMap = new Map(freshBill.items.map((i) => [i.id, i]));
  const ordered = existingBill.items
    .filter((i) => freshMap.has(i.id))
    .map((i) => freshMap.get(i.id)!);
  const existingIds = new Set(existingBill.items.map((i) => i.id));
  const appended = freshBill.items.filter((i) => !existingIds.has(i.id));

  // Re-attach any optimistic assignments still in-flight (not yet in the fresh bill).
  const confirmedKeys = new Set(
    freshBill.assignments.map((a) => `${a.billItemId}|${a.participantId}|${a.unitIndex}`)
  );
  const pendingOptimistic = existingBill.assignments.filter(
    (a) =>
      a.id.startsWith("temp-") &&
      !confirmedKeys.has(`${a.billItemId}|${a.participantId}|${a.unitIndex}`)
  );

  return {
    ...freshBill,
    items: [...ordered, ...appended],
    assignments: [...freshBill.assignments, ...pendingOptimistic],
  };
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message ?? "API error");
  }
  return json.data as T;
}

export const useBillStore = create<BillState>((set) => ({
  currentBill: null,
  splitResult: null,
  ocrResult: null,

  createBill: async (title, currency) => {
    const bill = await apiFetch<BillDto>("/api/bills", {
      method: "POST",
      body: JSON.stringify({ title, currency }),
    });
    set({ currentBill: bill });
    return bill;
  },

  loadBill: async (billId) => {
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill, splitResult: null });
  },

  updateBillMeta: async (billId, data) => {
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
  },

  addItem: async (billId, item) => {
    await apiFetch(`/api/bills/${billId}/items`, {
      method: "POST",
      body: JSON.stringify(item),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
  },

  batchAddItems: async (billId, items) => {
    await apiFetch(`/api/bills/${billId}/items/batch`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
  },

  updateItem: async (billId, itemId, patch) => {
    await apiFetch(`/api/bills/${billId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
  },

  deleteItem: async (billId, itemId) => {
    await apiFetch(`/api/bills/${billId}/items/${itemId}`, { method: "DELETE" });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
  },

  addParticipant: async (billId, name, userId) => {
    const tempId = `temp-${Date.now()}`;
    set((state) => {
      if (!state.currentBill) return state;
      return {
        currentBill: {
          ...state.currentBill,
          participants: [
            ...state.currentBill.participants,
            { id: tempId, name, userId: userId ?? null, createdAt: new Date().toISOString() },
          ],
        },
      };
    });
    try {
      await apiFetch(`/api/bills/${billId}/participants`, {
        method: "POST",
        body: JSON.stringify({ name, userId: userId ?? null }),
      });
      const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
      set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
    } catch (err) {
      const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
      set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
      throw err;
    }
  },

  updateParticipant: async (billId, participantId, name) => {
    set((state) => {
      if (!state.currentBill) return state;
      return {
        currentBill: {
          ...state.currentBill,
          participants: state.currentBill.participants.map((p) =>
            p.id === participantId ? { ...p, name } : p
          ),
        },
      };
    });
    try {
      await apiFetch(`/api/bills/${billId}/participants/${participantId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
      set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
    } catch (err) {
      const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
      set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
      throw err;
    }
  },

  removeParticipant: async (billId, participantId) => {
    set((state) => {
      if (!state.currentBill) return state;
      return {
        currentBill: {
          ...state.currentBill,
          participants: state.currentBill.participants.filter((p) => p.id !== participantId),
          assignments: state.currentBill.assignments.filter((a) => a.participantId !== participantId),
        },
      };
    });
    try {
      await apiFetch(`/api/bills/${billId}/participants/${participantId}`, { method: "DELETE" });
      const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
      set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
    } catch (err) {
      const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
      set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
      throw err;
    }
  },

  assignUnit: async (billId, itemId, participantId, unitIndex) => {
    // Optimistic update: add assignment immediately so button toggles without waiting
    set((state) => {
      if (!state.currentBill) return state;
      return {
        currentBill: {
          ...state.currentBill,
          assignments: [
            ...state.currentBill.assignments,
            { id: `temp-${Date.now()}`, billItemId: itemId, participantId, unitIndex },
          ],
        },
      };
    });
    try {
      await apiFetch(`/api/bills/${billId}/assignments`, {
        method: "POST",
        body: JSON.stringify({ itemId, participantId, unitIndex }),
      });
      // No bill reload on success — the optimistic state is already correct.
      // Reloading here would race against other in-flight assignments and wipe
      // their optimistic updates, causing buttons to flash deselected.
    } catch (err) {
      // Remove the failed temp assignment first, then reload to sync server state.
      set((state) => {
        if (!state.currentBill) return state;
        return {
          currentBill: {
            ...state.currentBill,
            assignments: state.currentBill.assignments.filter(
              (a) =>
                !(a.id.startsWith("temp-") &&
                  a.billItemId === itemId &&
                  a.participantId === participantId &&
                  a.unitIndex === unitIndex)
            ),
          },
        };
      });
      const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
      set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
      throw err;
    }
  },

  unassignUnit: async (billId, itemId, participantId, unitIndex) => {
    // Optimistic update: remove assignment immediately so button toggles without waiting
    set((state) => {
      if (!state.currentBill) return state;
      return {
        currentBill: {
          ...state.currentBill,
          assignments: state.currentBill.assignments.filter(
            (a) =>
              !(a.billItemId === itemId &&
                a.participantId === participantId &&
                a.unitIndex === unitIndex)
          ),
        },
      };
    });
    try {
      await apiFetch(`/api/bills/${billId}/assignments`, {
        method: "DELETE",
        body: JSON.stringify({ itemId, participantId, unitIndex }),
      });
      // No bill reload on success — the optimistic state is already correct.
    } catch (err) {
      // Revert optimistic update by reloading fresh bill
      const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
      set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
      throw err;
    }
  },

  calculateSplit: async (billId) => {
    const result = await apiFetch<SplitResultDto>(`/api/bills/${billId}/split`);
    set({ splitResult: result });
  },

  uploadReceiptOcr: async (billId, file) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch(`/api/bills/${billId}/ocr`, {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error?.message ?? "OCR failed");
    set({ ocrResult: json.data as OcrResultDto });
  },

  setItemSplitConfig: async (billId, itemId, splitConfig) => {
    await apiFetch(`/api/bills/${billId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ splitConfig }),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set((state) => ({ currentBill: withStableItemOrder(state.currentBill, bill) }));
  },

  clearOcrResult: () => set({ ocrResult: null }),
}));
