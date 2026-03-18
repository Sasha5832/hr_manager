import React, { useContext, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiGet, normalizeList } from "../api";
import { BACKEND_BASE } from "../http";
import { AuthContext } from "../context/AuthContext";
import { NavItem } from "../components/NavItem";

export function Shell({ children }) {
  const { isAuthed, setIsAuthed, isManager, setIsManager } =
    useContext(AuthContext);
  const navigate = useNavigate();
  const [userLabel, setUserLabel] = useState(null);

  useEffect(() => {
    async function loadMeAndRole() {
      try {
        const resp = await apiGet("/api/me/");
        const u = resp.user || {};

        let label = "";
        if (u.first_name || u.last_name) {
          label = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        }
        if (u.email) {
          label = label ? `${label} (${u.email})` : u.email;
        }
        if (!label) label = "nieznany użytkownik";
        setUserLabel(label);

        if (u && (u.is_staff === true || u.is_superuser === true)) {
          setIsManager(true);
          return;
        }

        const empRes = await apiGet("/api/employees/");
        const emps = normalizeList(empRes);
        setIsManager(emps.length > 1);
      } catch (err) {
        setUserLabel(null);
        setIsManager(false);
      }
    }

    loadMeAndRole();
  }, [isAuthed, setIsManager]);

  let statusText = "Sprawdzanie…";
  if (isAuthed === true) statusText = "Zalogowany";
  if (isAuthed === false) statusText = "Niezalogowany";

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-extrabold">
              HR
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                HR Manager
              </div>
              <div className="text-xs text-slate-400">
                Obecność • Oceny • Urlopy
              </div>
            </div>
          </div>

          <nav className="hidden md:flex gap-3 text-sm">
            <NavItem to="/">Dashboard</NavItem>
            <NavItem to="/leave">Urlopy</NavItem>
            <NavItem to="/performance">Oceny</NavItem>
            <NavItem to="/attendance">Obecność</NavItem>
            <NavItem to="/employees">Pracownicy</NavItem>
          </nav>

          <div className="flex items-center gap-2 text-xs text-right">
            <div className="flex flex-col items-end leading-tight">
              <span className="text-slate-400">
                Status:{" "}
                <span className="text-slate-100 font-medium">{statusText}</span>
              </span>
              {userLabel && (
                <span className="text-[11px] text-slate-300">{userLabel}</span>
              )}
              {isAuthed && (
                <span className="text-[10px] text-slate-500">
                  Rola: {isManager ? "Manager/Admin" : "Pracownik"}
                </span>
              )}
            </div>

            {isAuthed ? (
              <button
                onClick={async () => {
                  try {
                    await fetch(`${BACKEND_BASE}/accounts/logout/`, {
                      method: "GET",
                      credentials: "include",
                    });
                  } finally {
                    setIsAuthed(false);
                    setIsManager(false);
                    navigate("/login", { replace: true });
                  }
                }}
                className="px-2 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300 text-xs"
              >
                Wyloguj
              </button>
            ) : (
              <NavLink
                to="/login"
                className="px-2 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300 text-xs"
              >
                Zaloguj
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto flex-1 w-full px-4 py-4 md:py-6">
        {children}
      </div>

      <footer className="border-t border-slate-900 bg-slate-950/90 text-xs text-slate-500 mt-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <span>HR Manager – frontend React + Tailwind</span>
          <span className="hidden sm:inline">
            Backend: Django • Frontend: React
          </span>
        </div>
      </footer>
    </div>
  );
}


