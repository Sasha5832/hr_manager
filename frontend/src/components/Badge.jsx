import React from "react";
import { classNames } from "../utils/classNames";

export function Badge({ children, tone = "default" }) {
  const toneClasses =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/50"
      : tone === "warning"
        ? "bg-amber-500/15 text-amber-300 border-amber-500/50"
        : tone === "danger"
          ? "bg-rose-500/15 text-rose-300 border-rose-500/50"
          : "bg-slate-800/80 text-slate-200 border-slate-600";

  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        toneClasses,
      )}
    >
      {children}
    </span>
  );
}
