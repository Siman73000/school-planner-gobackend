import React from "react";
import { monthGrid, startOfDay, isSameDay } from "../lib/date";

export function CalendarMonth({
  year,
  monthIndex,
  weekStartsOn,
  selected,
  onSelect,
  dayMeta,
}: {
  year: number;
  monthIndex: number;
  weekStartsOn: 0 | 1;
  selected: Date;
  onSelect: (d: Date) => void;
  dayMeta: (d: Date) => { count: number };
}) {
  const days = monthGrid(year, monthIndex, weekStartsOn);
  const today = startOfDay(new Date());
  const sel = startOfDay(selected);

  const labels = weekStartsOn === 1
    ? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  return (
    <div>
      <div className="grid grid-cols-7 gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {labels.map((l) => <div key={l} className="px-2 py-1">{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((d, idx) => {
          const meta = dayMeta(d);
          const inMonth = d.getMonth() === monthIndex;
          const isToday = isSameDay(d, today);
          const isSelected = isSameDay(d, sel);

          return (
            <button
              key={idx}
              onClick={() => onSelect(d)}
              className={[
                "group rounded-2xl border px-2 py-2 text-left transition",
                "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900",
                inMonth ? "" : "opacity-50",
                isSelected ? "ring-2 ring-slate-400/30" : "",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className={[
                  "text-sm font-semibold",
                  isToday ? "text-sky-700 dark:text-sky-300" : "text-slate-900 dark:text-slate-100"
                ].join(" ")}>
                  {d.getDate()}
                </div>
                {meta.count > 0 ? (
                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-950">
                    {meta.count}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-900">
                <div
                  className="h-1.5 rounded-full bg-slate-300 dark:bg-slate-700"
                  style={{ width: `${Math.min(100, meta.count * 20)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
