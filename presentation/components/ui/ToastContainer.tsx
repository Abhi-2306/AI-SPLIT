"use client";

import { useUiStore } from "@/presentation/store/uiStore";
import { useEffect } from "react";

export function ToastContainer() {
  const { toasts, dismissToast } = useUiStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <AutoDismissToast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

function AutoDismissToast({
  toast,
  onDismiss,
}: {
  toast: { id: string; message: string; variant: string };
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const variantClass =
    toast.variant === "success"
      ? "bg-green-600"
      : toast.variant === "error"
      ? "bg-red-600"
      : "bg-slate-700";

  return (
    <div
      className={`${variantClass} text-white px-4 py-3 rounded-lg shadow-lg flex items-start gap-3 animate-in slide-in-from-bottom-2`}
    >
      <span className="flex-1 text-sm">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/70 hover:text-white text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
