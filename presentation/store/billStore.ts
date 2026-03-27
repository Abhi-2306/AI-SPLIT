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
  updateBillMeta: (billId: string, data: { title?: string; tax?: number | null; tip?: number | null; paidByParticipantId?: string | null }) => Promise<void>;
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
    set({ currentBill: bill });
  },

  addItem: async (billId, item) => {
    await apiFetch(`/api/bills/${billId}/items`, {
      method: "POST",
      body: JSON.stringify(item),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
  },

  batchAddItems: async (billId, items) => {
    await apiFetch(`/api/bills/${billId}/items/batch`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
  },

  updateItem: async (billId, itemId, patch) => {
    await apiFetch(`/api/bills/${billId}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
  },

  deleteItem: async (billId, itemId) => {
    await apiFetch(`/api/bills/${billId}/items/${itemId}`, { method: "DELETE" });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
  },

  addParticipant: async (billId, name, userId) => {
    await apiFetch(`/api/bills/${billId}/participants`, {
      method: "POST",
      body: JSON.stringify({ name, userId: userId ?? null }),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
  },

  updateParticipant: async (billId, participantId, name) => {
    await apiFetch(`/api/bills/${billId}/participants/${participantId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
  },

  removeParticipant: async (billId, participantId) => {
    await apiFetch(`/api/bills/${billId}/participants/${participantId}`, {
      method: "DELETE",
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
  },

  assignUnit: async (billId, itemId, participantId, unitIndex) => {
    await apiFetch(`/api/bills/${billId}/assignments`, {
      method: "POST",
      body: JSON.stringify({ itemId, participantId, unitIndex }),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
  },

  unassignUnit: async (billId, itemId, participantId, unitIndex) => {
    await apiFetch(`/api/bills/${billId}/assignments`, {
      method: "DELETE",
      body: JSON.stringify({ itemId, participantId, unitIndex }),
    });
    const bill = await apiFetch<BillDto>(`/api/bills/${billId}`);
    set({ currentBill: bill });
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
    set({ currentBill: bill });
  },

  clearOcrResult: () => set({ ocrResult: null }),
}));
