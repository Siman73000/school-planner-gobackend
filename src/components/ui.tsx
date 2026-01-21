import React from "react";

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-slate-400/30 disabled:opacity-50";
  const styles: Record<string, string> = {
    primary:
      "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white",
    outline:
      "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900",
    ghost:
      "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900",
    danger:
      "bg-rose-600 text-white hover:bg-rose-500 dark:bg-rose-600 dark:hover:bg-rose-500",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles[variant]} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  right,
  id,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  right?: React.ReactNode;
  id?: string;
}) {
  return (
    <label className="block">
      {label ? (
        <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {label}
        </div>
      ) : null}
      <div className="relative">
        <input
          id={id}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          value={value}
          type={type}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {right ? <div className="absolute right-2 top-2">{right}</div> : null}
      </div>
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      {label ? (
        <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {label}
        </div>
      ) : null}
      <select
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      {label ? (
        <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
          {label}
        </div>
      ) : null}
      <textarea
        className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const cls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
      : tone === "bad"
      ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
      : tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
      : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
  );
}

export function Card({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-900">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </div>
        <div className="flex items-center gap-2">{right}</div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
