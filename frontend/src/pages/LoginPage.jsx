import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../api";
import { BACKEND_BASE, ensureCsrfCookie, getCookie } from "../http";
import { AuthContext } from "../context/AuthContext";


export default function LoginPage() {
  const { setIsAuthed, setIsManager } = useContext(AuthContext);
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      await ensureCsrfCookie();
      const csrftoken = getCookie("csrftoken") || "";
      const form = new URLSearchParams();
      // allauth używa pola "login" (email/username zależnie od ustawień)
      form.set("login", login);
      form.set("password", password);

      await fetch(`${BACKEND_BASE}/accounts/login/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Requested-With": "XMLHttpRequest",
          ...(csrftoken ? { "X-CSRFToken": csrftoken } : {}),
        },
        body: form.toString(),
      });

      // allauth zwykle robi redirect (302). fetch to przyjmie jako ok=true.
      // Sprawdzamy czy sesja już działa:
      await apiGet("/api/me/");
      setIsAuthed(true);
      setIsManager(false);
      navigate("/", { replace: true });
    } catch (e2) {
      setIsAuthed(false);
      setIsManager(false);
      setErr("Nieprawidłowy email lub hasło");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-lg shadow-black/20">
        <div className="text-lg font-semibold">Logowanie</div>
        <div className="mt-1 text-sm text-slate-400">
          Zaloguj się, aby korzystać z aplikacji
        </div>

        {err && (
          <div className="mt-4 rounded-2xl border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        )}

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div>
            <label className="text-xs text-slate-400">Email</label>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm outline-none focus:border-indigo-500/60"
              placeholder="adres@email.com"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-400">Hasło</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm outline-none focus:border-indigo-500/60"
              placeholder="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-indigo-600/20 px-4 py-2 text-sm font-semibold text-indigo-200 ring-1 ring-indigo-500/40 hover:bg-indigo-600/30 disabled:opacity-60"
          >
            {loading ? "..." : "Zaloguj"}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-500">
          Nie masz konta? Poproś administratora o dostęp.
        </div>
      </div>
    </div>
  );
}

