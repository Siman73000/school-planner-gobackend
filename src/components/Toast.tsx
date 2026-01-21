import React, { useEffect } from "react";

export type ToastType = "info" | "success" | "error";

export function Toast({
  open,
  type,
  message,
  onClose,
}: {
  open: boolean;
  type: ToastType;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(onClose, 2200);
    return () => window.clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  const tone =
    type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
      : type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100"
      : "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`rounded-2xl border px-4 py-3 shadow-lg ${tone}`}>
        <div className="text-sm font-medium">{message}</div>
      </div>
    </div>
  );
}
