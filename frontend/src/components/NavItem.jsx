import React from "react";
import { NavLink } from "react-router-dom";
import { classNames } from "../utils/classNames";

export function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        classNames(
          "px-3 py-1 rounded-lg transition text-slate-300 hover:text-emerald-300 hover:bg-slate-800/70",
          isActive &&
            "bg-slate-800 text-emerald-300 border border-emerald-500/60",
        )
      }
    >
      {children}
    </NavLink>
  );
}

// ---------------- UI POMOCNICZE ----------------
