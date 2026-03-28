"use client";

import { Button } from "./Button";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  loading,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
