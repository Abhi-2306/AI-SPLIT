"use client";

import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
};

export type OcrStatus = "idle" | "uploading" | "processing" | "complete" | "error";

type UiState = {
  isLoading: boolean;
  ocrStatus: OcrStatus;
  ocrProgress: number;
  toasts: Toast[];
  setLoading: (loading: boolean) => void;
  setOcrStatus: (status: OcrStatus, progress?: number) => void;
  addToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
};

export const useUiStore = create<UiState>((set) => ({
  isLoading: false,
  ocrStatus: "idle",
  ocrProgress: 0,
  toasts: [],

  setLoading: (loading) => set({ isLoading: loading }),

  setOcrStatus: (status, progress = 0) =>
    set({ ocrStatus: status, ocrProgress: progress }),

  addToast: (message, variant = "info") =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: Math.random().toString(36).slice(2), message, variant },
      ],
    })),

  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
