import React, { useEffect, useState, useContext } from "react";
import { apiGet, normalizeList, ApiError } from "../api";
import { BACKEND_BASE } from "../http";
import { AuthContext } from "../context/AuthContext";
import { Badge } from "../components/Badge";
import { ChartSwitcher } from "../components/ChartSwitcher";
import { PagedTable } from "../components/PagedTable";
import { buildPerfSeries } from "../utils/performance";

export default function PerformancePage() {
  const { setIsAuthed } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet("/api/performance/");
        setReviews(normalizeList(data));
        setIsAuthed(true);
      } catch (e) {
        console.error(e);
        if (e instanceof ApiError && e.status === 403) {
          setError("Brak uprawnień do przeglądania ocen. Zaloguj się.");
          setIsAuthed(false);
        } else {
          setError("Nie udało się załadować ocen.");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setIsAuthed]);

  const series = buildPerfSeries(reviews);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Oceny miesięczne</h1>
          <p className="text-xs text-slate-400">
            Miesięczne podsumowanie wyników i frekwencji.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <a
            href={`${BACKEND_BASE}/api/performance/export/?file=csv`}
            className="px-3 py-1 rounded-xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
          >
            Eksport CSV
          </a>
          <a
            href={`${BACKEND_BASE}/api/performance/export/?file=xlsx`}
            className="px-3 py-1 rounded-xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
          >
            Eksport XLSX
          </a>
          <a
            href={`${BACKEND_BASE}/api/performance/export/?file=pdf`}
            className="px-3 py-1 rounded-xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
          >
            Eksport PDF
          </a>
        </div>
      </div>

      {loading && (
        <div className="card p-3 text-xs text-slate-300">Ładowanie ocen…</div>
      )}
      {error && (
        <div className="card p-3 border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <ChartSwitcher
            allowPie={false}
            title="Średnia frekwencja wg miesiąca"
            labels={series.labels}
            values={series.values}
          />

          <PagedTable
            rows={reviews}
            emptyText="Brak ocen do wyświetlenia."
            columns={[
              { key: "id", header: "ID", render: (r) => r.id },
              {
                key: "emp",
                header: "Pracownik",
                thClassName: "min-w-[220px]",
                render: (r) =>
                  r.employee && r.employee.user ? r.employee.user.email : "-",
              },
              {
                key: "month",
                header: "Miesiąc",
                render: (r) => String(r.month).padStart(2, "0"),
              },
              { key: "year", header: "Rok", render: (r) => r.year },
              {
                key: "wd",
                header: "Dni robocze",
                render: (r) => r.working_days,
              },
              {
                key: "abs",
                header: "Nieobecności",
                render: (r) => r.absent_days,
              },
              {
                key: "score",
                header: "Frekwencja",
                render: (r) => (
                  <Badge
                    tone={
                      r.attendance_score >= 95
                        ? "success"
                        : r.attendance_score >= 85
                          ? "warning"
                          : "danger"
                    }
                  >
                    {r.attendance_score}%
                  </Badge>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
