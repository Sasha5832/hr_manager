import React from "react";
import { classNames } from "../utils/classNames";

export function Stat({ label, value, tone = "default" }) {
  const toneClasses =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
      : tone === "danger"
        ? "bg-rose-500/10 text-rose-300 border-rose-500/40"
        : tone === "warning"
          ? "bg-amber-500/10 text-amber-300 border-amber-500/40"
          : "bg-slate-800/80 text-slate-100 border-slate-700";

  return (
    <div
      className={classNames(
        "card px-4 py-3 flex flex-col gap-1 border",
        toneClasses,
      )}
    >
      <span className="text-xs uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}
