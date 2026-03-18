import React, { useEffect, useState, useContext } from "react";
import { apiGet, normalizeList, ApiError } from "../api";
import { BACKEND_BASE, apiPost } from "../http";
import { AuthContext } from "../context/AuthContext";
import { Badge } from "../components/Badge";
import { PagedTable } from "../components/PagedTable";
import { fmtDateTime } from "../utils/format";

export default function LeavesPage() {
  const { setIsAuthed, isManager } = useContext(AuthContext);
  const [showNew, setShowNew] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newBusy, setNewBusy] = useState(false);
  const [newErr, setNewErr] = useState(null);
  const [leaveInfo, setLeaveInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet("/api/leave-requests/");
      setLeaves(normalizeList(data));
      setIsAuthed(true);
      try {
        const me = await apiGet("/api/me/");
        setLeaveInfo(me.leave || null);
      } catch {
        setLeaveInfo(null);
      }
    } catch (e) {
      console.error(e);
      if (e instanceof ApiError && e.status === 403) {
        setError("Brak uprawnień do przeglądania wniosków. Zaloguj się.");
        setIsAuthed(false);
      } else {
        setError("Nie udało się załadować wniosków urlopowych.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [setIsAuthed]);

  const getTone = (st) =>
    st === "approved"
      ? "success"
      : st === "rejected"
        ? "danger"
        : st === "pending"
          ? "warning"
          : "default";

  const getStatusLabel = (st) =>
    st === "approved"
      ? "Zaakceptowany"
      : st === "rejected"
        ? "Odrzucony"
        : st === "pending"
          ? "Oczekuje"
          : st;

  async function approve(id) {
    if (!window.confirm(`Zaakceptować wniosek #${id}?`)) return;
    try {
      setBusyId(id);
      await apiPost(`/api/leave-requests/${id}/approve/`);
      await load();
    } catch (e) {
      console.error(e);
      alert(
        e?.message ||
          "Nie udało się zaktualizować wniosku. Spróbuj ponownie.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id) {
    if (!window.confirm(`Odrzucić wniosek #${id}?`)) return;
    try {
      setBusyId(id);
      await apiPost(`/api/leave-requests/${id}/reject/`);
      await load();
    } catch (e) {
      console.error(e);
      alert(
        e?.message ||
          "Nie udało się zaktualizować wniosku. Spróbuj ponownie.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Urlopy</h1>
          <p className="text-xs text-slate-400">
            Przegląd wniosków urlopowych oraz historii urlopów.
          </p>
        </div>
        <a
          href="#new-leave"
          onClick={(e) => {
            e.preventDefault();
            setShowNew((v) => !v);
            setNewErr(null);
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
        >
          + Nowy wniosek
        </a>
      </div>

      {showNew && (
        <div className="card p-4 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Nowy wniosek urlopowy</h2>
            <button
              onClick={() => setShowNew(false)}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
            >
              Zamknij
            </button>
          </div>

          {leaveInfo && (
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="text-[11px] text-slate-400">
                  Limit ({leaveInfo.year})
                </div>
                <div className="text-slate-100 font-semibold">
                  {leaveInfo.limit}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="text-[11px] text-slate-400">Wykorzystano</div>
                <div className="text-slate-100 font-semibold">
                  {leaveInfo.used_approved ?? leaveInfo.used}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                <div className="text-[11px] text-slate-400">Zarezerwowano</div>
                <div className="text-slate-100 font-semibold">
                  {leaveInfo.reserved_pending ?? 0}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                <div className="text-[11px] text-slate-400">Pozostało</div>
                <div className="text-emerald-300 font-semibold">
                  {leaveInfo.remaining}
                </div>
              </div>
            </div>
          )}

          {newErr && (
            <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              {newErr}
            </div>
          )}

          <form
            className="grid sm:grid-cols-3 gap-3 text-xs"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                setNewErr(null);
                setNewBusy(true);
                await apiPost("/api/leave-requests/", {
                  start_date: newStart,
                  end_date: newEnd,
                  reason: newReason,
                });
                setNewStart("");
                setNewEnd("");
                setNewReason("");
                setShowNew(false);
                await load();
              } catch (err) {
                console.error(err);
                setNewErr(err?.message || "Nie udało się utworzyć wniosku.");
              } finally {
                setNewBusy(false);
              }
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Start</label>
              <input
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
                onFocus={(e) => e.target.showPicker?.()}
                onClick={(e) => e.target.showPicker?.()}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Koniec</label>
              <input
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                onFocus={(e) => e.target.showPicker?.()}
                onClick={(e) => e.target.showPicker?.()}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                required
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-3">
              <label className="text-slate-400">Powód</label>
              <textarea
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="min-h-[70px] rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                placeholder="Opcjonalnie…"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={newBusy}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {newBusy ? "Zapisywanie…" : "Utwórz wniosek"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="card p-3 text-xs text-slate-300">
          Ładowanie wniosków…
        </div>
      )}
      {error && (
        <div className="card p-3 border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <PagedTable
          rows={leaves}
          emptyText="Brak wniosków do wyświetlenia."
          columns={[
            {
              key: "id",
              header: "ID",
              render: (l) => <span className="text-slate-300">{l.id}</span>,
            },
            {
              key: "emp",
              header: "Pracownik",
              thClassName: "min-w-[220px]",
              render: (l) => {
                const email =
                  l.employee && l.employee.user
                    ? l.employee.user.email
                    : l.employee_email || "-";
                return <span className="text-slate-100">{email}</span>;
              },
            },
            {
              key: "period",
              header: "Okres",
              thClassName: "min-w-[170px]",
              render: (l) => (
                <span className="text-slate-200">
                  {l.start_date} → {l.end_date}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (l) => (
                <Badge tone={getTone(l.status)}>{getStatusLabel(l.status)}</Badge>
              ),
            },
            {
              key: "days",
              header: "Dni",
              render: (l) => <span className="text-slate-200">{l.days ?? "—"}</span>,
            },
            {
              key: "created",
              header: "Utworzono",
              thClassName: "min-w-[150px]",
              render: (l) => (
                <span className="text-slate-300">{fmtDateTime(l.created_at)}</span>
              ),
            },
            ...(isManager
              ? [
                  {
                    key: "actions",
                    header: "Akcje",
                    thClassName: "min-w-[190px]",
                    render: (l) =>
                      l.status === "pending" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(l.id)}
                            disabled={busyId === l.id}
                            className="px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
                          >
                            Zatwierdź
                          </button>
                          <button
                            onClick={() => reject(l.id)}
                            disabled={busyId === l.id}
                            className="px-3 py-1 rounded-lg border border-rose-500/60 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
                          >
                            Odrzuć
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">—</span>
                      ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}
