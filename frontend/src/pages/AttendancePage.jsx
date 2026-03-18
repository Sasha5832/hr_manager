import React, { useEffect, useState, useContext } from "react";
import { apiGet, normalizeList, ApiError } from "../api";
import { BACKEND_BASE, apiPost, getCookie } from "../http";
import { AuthContext } from "../context/AuthContext";
import { Badge } from "../components/Badge";
import { PagedTable } from "../components/PagedTable";

export default function AttendancePage() {
  const { setIsAuthed, isManager } = useContext(AuthContext);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [emps, setEmps] = useState([]);
  const [attEmpId, setAttEmpId] = useState("");
  const [attDate, setAttDate] = useState("");
  const [attStatus, setAttStatus] = useState("present");
  const [attMinutes, setAttMinutes] = useState(480);
  const [attNotes, setAttNotes] = useState("");
  const [attBusy, setAttBusy] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiGet("/api/attendance/");
        setRows(normalizeList(data));
        setIsAuthed(true);
      } catch (e) {
        console.error(e);
        if (e instanceof ApiError && e.status === 403) {
          setError("Brak uprawnień do przeglądania obecności. Zaloguj się.");
          setIsAuthed(false);
        } else {
          setError(
            "Nie udało się załadować obecności. Spróbuj ponownie później.",
          );
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setIsAuthed]);

  useEffect(() => {
    async function loadEmps() {
      if (!isManager) return;
      try {
        const data = await apiGet("/api/employees/");
        setEmps(normalizeList(data));
      } catch {}
    }
    loadEmps();
  }, [isManager]);

  const statusLabel = {
    present: "Obecny",
    remote: "Zdalnie",
    sick: "Chorobowe",
    vacation: "Urlop",
    absent: "Nieobecny",
  };

  const statusTone = {
    present: "success",
    remote: "default",
    sick: "warning",
    vacation: "default",
    absent: "danger",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Obecność</h1>
          <p className="text-xs text-slate-400">
            Rejestr dziennej obecności pracowników.
          </p>
        </div>

        {isManager && (
          <div className="flex flex-wrap gap-2 text-xs">
            <a
              href="#new-att"
              onClick={(e) => {
                e.preventDefault();
                setShowNew((v) => !v);
              }}
              className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400"
            >
              + Nowy wpis
            </a>
            <a
              href="#import-att"
              onClick={(e) => {
                e.preventDefault();
                setShowImport((v) => !v);
                setImportMsg(null);
              }}
              className="px-3 py-1 rounded-xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
            >
              Import CSV
            </a>
          </div>
        )}
      </div>

      {isManager && showNew && (
        <div className="card p-4 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Nowy wpis obecności</h2>
            <button
              onClick={() => setShowNew(false)}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
            >
              Zamknij
            </button>
          </div>

          <form
            className="grid md:grid-cols-2 gap-3 text-xs"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setAttBusy(true);
                const payload = {
                  date: attDate,
                  status: attStatus,
                  minutes_worked: Number(attMinutes) || 0,
                  notes: attNotes,
                };
                if (attEmpId) payload.employee_id = Number(attEmpId);
                await apiPost("/api/attendance/", payload);
                setAttDate("");
                setAttNotes("");
                setShowNew(false);
                const data = await apiGet("/api/attendance/");
                setRows(normalizeList(data));
              } catch (err) {
                console.error(err);
                alert(err?.message || "Nie udało się dodać wpisu.");
              } finally {
                setAttBusy(false);
              }
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Pracownik</label>
              <select
                value={attEmpId}
                onChange={(e) => setAttEmpId(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
              >
                <option value="">Automatycznie — bieżący użytkownik</option>
                {emps.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.user?.email || `Employee #${e.id}`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Data</label>
              <input
                type="date"
                value={attDate}
                onChange={(e) => setAttDate(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Status</label>
              <select
                value={attStatus}
                onChange={(e) => setAttStatus(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
              >
                <option value="present">Obecny</option>
                <option value="remote">Zdalnie</option>
                <option value="sick">Chorobowe</option>
                <option value="vacation">Urlop</option>
                <option value="absent">Nieobecny</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Minuty</label>
              <input
                type="number"
                min="0"
                value={attMinutes}
                onChange={(e) => setAttMinutes(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-slate-400">Notatki</label>
              <input
                value={attNotes}
                onChange={(e) => setAttNotes(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                placeholder="Opcjonalnie…"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={attBusy}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {attBusy ? "Zapisywanie…" : "Dodaj"}
              </button>
            </div>
          </form>
        </div>
      )}

      {isManager && showImport && (
        <div className="card p-4 border border-slate-700 bg-slate-900/40">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Import CSV</h2>
            <button
              onClick={() => setShowImport(false)}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
            >
              Zamknij
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-3">
            CSV kolumny:{" "}
            <span className="text-slate-200">
              email,date,status,minutes,notes
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="text-xs"
            />

            <button
              disabled={!importFile || importBusy}
              onClick={async () => {
                if (!importFile) return;
                try {
                  setImportBusy(true);
                  const csrftoken = getCookie("csrftoken") || "";
                  const form = new FormData();
                  form.append("file", importFile);
                  const resp = await fetch(
                    `${BACKEND_BASE}/api/attendance/import/`,
                    {
                      method: "POST",
                      credentials: "include",
                      headers: {
                        "X-Requested-With": "XMLHttpRequest",
                        ...(csrftoken ? { "X-CSRFToken": csrftoken } : {}),
                      },
                      body: form,
                    },
                  );

                  // Odczytujemy raport JSON, jeśli backend go zwrócił.
                  let report = {};
                  try {
                    report = await resp.json();
                  } catch {
                    report = {};
                  }

                  if (!resp.ok) {
                    const msg = report?.detail || `HTTP ${resp.status}`;
                    throw new Error(msg);
                  }

                  // Jeśli backend zwrócił błędy w wierszach, pokazujemy komunikat i odświeżamy listę.
                  if (
                    report &&
                    (report.error_rows ||
                      (Array.isArray(report.errors) && report.errors.length))
                  ) {
                    const first =
                      Array.isArray(report.errors) && report.errors.length
                        ? report.errors[0]
                        : null;
                    setImportMsg(
                      <span className="text-rose-300">
                        {first
                          ? `Import zakończony z błędami. Pierwszy błąd: wiersz ${first.row ?? "?"} - ${first.message ?? "?"}`
                          : `Import zakończony z błędami. Liczba błędów: ${report.error_rows ?? "?"}`}
                      </span>,
                    );
                  } else {
                    setImportMsg("Import zakończony pomyślnie.");
                  }
                  setImportFile(null);
                  setShowImport(false);
                  const data = await apiGet("/api/attendance/");
                  setRows(normalizeList(data));
                } catch (err) {
                  console.error(err);
                  setImportMsg(err?.message || "Import nieudany.");
                } finally {
                  setImportBusy(false);
                }
              }}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-300 text-xs disabled:opacity-60"
            >
              {importBusy ? "Import…" : "Importuj"}
            </button>
          </div>
        </div>
      )}

      {importMsg && (
        <div className="mt-3 text-xs text-slate-200">{importMsg}</div>
      )}

      {loading && (
        <div className="card p-3 text-xs text-slate-300">
          Ładowanie obecności…
        </div>
      )}
      {error && (
        <div className="card p-3 border border-amber-500/40 bg-amber-500/10 text-xs text-amber-100">
          {error}
        </div>
      )}

      {!loading && !error && (
        <PagedTable
          rows={rows}
          emptyText="Brak wpisów obecności."
          columns={[
            {
              key: "date",
              header: "Data",
              render: (r) => r.date,
            },
            {
              key: "emp",
              header: "Pracownik",
              render: (r) =>
                r.employee && r.employee.user ? r.employee.user.email : "-",
            },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <Badge tone={statusTone[r.status] || "default"}>
                  {statusLabel[r.status] || r.status}
                </Badge>
              ),
            },
            {
              key: "minutes",
              header: "Minut",
              render: (r) => r.minutes_worked,
            },
            {
              key: "notes",
              header: "Notatki",
              thClassName: "min-w-[240px]",
              render: (r) => (
                <span className="text-slate-200">
                  {r.notes ? r.notes : "—"}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
