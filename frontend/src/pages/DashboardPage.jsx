import React, { useEffect, useState, useContext } from "react";
import { apiGet, normalizeList, ApiError } from "../api";
import { BACKEND_BASE } from "../http";
import { AuthContext } from "../context/AuthContext";
import { Stat } from "../components/Stat";
import { ChartSwitcher } from "../components/ChartSwitcher";
import { buildPerfSeries } from "../utils/performance";

export default function DashboardPage() {
  const { setIsAuthed, isManager } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [empRes, leaveRes, perfRes] = await Promise.all([
          apiGet("/api/employees/"),
          apiGet("/api/leave-requests/"),
          apiGet("/api/performance/"),
        ]);
        setEmployees(normalizeList(empRes));
        setLeaves(normalizeList(leaveRes));
        setReviews(normalizeList(perfRes));
        setIsAuthed(true);
      } catch (e) {
        console.error(e);
        if (e instanceof ApiError && e.status === 403) {
          setError("Brak uprawnień lub sesja wygasła. Zaloguj się ponownie.");
          setIsAuthed(false);
        } else {
          setError("Nie udało się załadować danych. Spróbuj ponownie później.");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setIsAuthed]);

  const totalEmployees = employees.length;
  const leavesPending = leaves.filter((l) => l.status === "pending").length;
  const leavesApproved = leaves.filter((l) => l.status === "approved").length;
  const leavesRejected = leaves.filter((l) => l.status === "rejected").length;
  const perfCount = reviews.length;
  const series = buildPerfSeries(reviews);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pulpit</h1>
          <p className="text-xs text-slate-400">
            Szybki podgląd pracowników, urlopów, obecności i ocen.
          </p>
        </div>

        {isManager && (
          <div className="hidden sm:flex gap-2 text-xs">
            <a
              href={`${BACKEND_BASE}/`}
              className="px-3 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
            >
              Panel systemu
            </a>
            <a
              href={`${BACKEND_BASE}/admin/`}
              className="px-3 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
            >
              Admin
            </a>
          </div>
        )}
      </div>

      {loading && (
        <div className="card p-4 text-xs text-slate-300">
          Ładowanie danych…
        </div>
      )}

      {error && (
        <div className="card p-3 border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Pracownicy" value={totalEmployees} />
            <Stat
              label="Wnioski oczekujące"
              value={leavesPending}
              tone="warning"
            />
            <Stat
              label="Wnioski zaakceptowane"
              value={leavesApproved}
              tone="success"
            />
            <Stat
              label="Wnioski odrzucone"
              value={leavesRejected}
              tone="danger"
            />
            <Stat label="Łączna liczba ocen" value={perfCount} />
          </div>
          <ChartSwitcher
            allowPie={false}
            title="Frekwencja według miesięcy"
            labels={series.labels}
            values={series.values}
          />
        </>
      )}
    </div>
  );
}
