import React, { useEffect, useState, useContext } from "react";
import { apiGet, normalizeList, ApiError } from "../api";
import { BACKEND_BASE, apiPost, apiPatch, apiDelete } from "../http";
import { AuthContext } from "../context/AuthContext";
import { Badge } from "../components/Badge";
import { PagedTable } from "../components/PagedTable";

export default function EmployeesPage() {
  const { setIsAuthed, isManager } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);

  // UI (tylko frontend)
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newBusy, setNewBusy] = useState(false);
  const [newErr, setNewErr] = useState(null);

  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPosition, setNewPosition] = useState("");
  const [newHireDate, setNewHireDate] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState(null);
  const [editId, setEditId] = useState(null);

  const [editEmail, setEditEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editHireDate, setEditHireDate] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await apiGet("/api/employees/");
      setEmployees(normalizeList(data));
      setIsAuthed(true);
    } catch (e) {
      console.error(e);
      if (e instanceof ApiError && e.status === 403) {
        setError("Brak uprawnień do przeglądania pracowników. Zaloguj się.");
        setIsAuthed(false);
      } else {
        setError("Nie udało się załadować listy pracowników.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [setIsAuthed]);

  const filtered = employees.filter((e) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const email = (e.user?.email || "").toLowerCase();
    const fn = (e.user?.first_name || "").toLowerCase();
    const ln = (e.user?.last_name || "").toLowerCase();
    const pos = (e.position || "").toLowerCase();
    const phone = (e.phone_number || "").toLowerCase();
    return (
      email.includes(needle) ||
      fn.includes(needle) ||
      ln.includes(needle) ||
      pos.includes(needle) ||
      phone.includes(needle)
    );
  });

  function openEdit(emp) {
    setEditErr(null);
    setEditPassword("");
    setEditId(emp.id);
    setEditEmail(emp.user?.email || "");
    setEditFirstName(emp.user?.first_name || "");
    setEditLastName(emp.user?.last_name || "");
    setEditIsActive(emp.user?.is_active ?? true);
    setEditPhone(emp.phone_number || "");
    setEditPosition(emp.position || "");
    setEditHireDate(emp.hire_date || "");
    setEditOpen(true);
  }

  async function createEmployee(e) {
    e.preventDefault();
    setNewErr(null);

    if (!newEmail || !newPhone || !newPosition || !newHireDate) {
      setNewErr(
        "Wypełnij wymagane pola: email, telefon, stanowisko, data zatrudnienia.",
      );
      return;
    }

    try {
      setNewBusy(true);

      // Nowy endpoint w backendzie (views.py): /api/employees/create-with-user/
      await apiPost("/api/employees/create-with-user/", {
        email: newEmail,
        password: newPassword || undefined,
        first_name: newFirstName || undefined,
        last_name: newLastName || undefined,
        phone_number: newPhone,
        position: newPosition,
        hire_date: newHireDate,
      });

      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewPassword("");
      setNewPhone("");
      setNewPosition("");
      setNewHireDate("");
      setShowNew(false);
      await load();
    } catch (err) {
      console.error(err);
      setNewErr(err?.message || "Nie udało się dodać pracownika.");
    } finally {
      setNewBusy(false);
    }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editId) return;
    setEditErr(null);

    try {
      setEditBusy(true);

      // 1) aktualizacja pól Employee
      await apiPatch(`/api/employees/${editId}/`, {
        phone_number: editPhone,
        position: editPosition,
        hire_date: editHireDate,
      });

      // 2) aktualizacja pól User (osobny endpoint w backendzie)
      await apiPatch(`/api/employees/${editId}/update-user/`, {
        email: editEmail,
        first_name: editFirstName,
        last_name: editLastName,
        is_active: editIsActive,
      });

      // 3) opcjonalnie: zmiana hasła
      if (editPassword && editPassword.trim()) {
        await apiPost(`/api/employees/${editId}/set-password/`, {
          password: editPassword,
        });
      }

      setEditOpen(false);
      await load();
    } catch (err) {
      console.error(err);
      setEditErr(err?.message || "Nie udało się zapisać zmian.");
    } finally {
      setEditBusy(false);
    }
  }

  async function removeEmployee(emp) {
    if (
      !window.confirm(
        `Usunąć pracownika ID=${emp.id} (${emp.user?.email || "bez email"})?`,
      )
    )
      return;
    try {
      await apiDelete(`/api/employees/${emp.id}/`);
      await load();
    } catch (err) {
      console.error(err);
      alert(err?.message || "Nie udało się usunąć pracownika.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Pracownicy</h1>
          <p className="text-xs text-slate-400">
            Zarządzanie danymi pracowników.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Szukaj: email / imię / stanowisko / telefon…"
            className="w-72 max-w-full rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs outline-none focus:border-emerald-500/60"
          />

          {isManager && (
            <>
              <button
                onClick={() => {
                  setNewErr(null);
                  setShowNew((v) => !v);
                }}
                className="px-3 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400"
              >
                + Nowy pracownik
              </button>

              <a
                href={`${BACKEND_BASE}/admin/core/employee/`}
                className="px-3 py-2 rounded-xl border border-slate-700 text-xs hover:border-emerald-500 hover:text-emerald-300"
              >
                Admin
              </a>
            </>
          )}
        </div>
      </div>

      {isManager && showNew && (
        <div className="card p-4 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Dodaj pracownika</h2>
            <button
              onClick={() => setShowNew(false)}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
            >
              Zamknij
            </button>
          </div>

          {newErr && (
            <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              {newErr}
            </div>
          )}

          <form
            className="grid md:grid-cols-2 gap-3 text-xs"
            onSubmit={createEmployee}
          >
            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Email *</label>
              <input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                placeholder="email"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Hasło — opcjonalne</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                placeholder="••••••••"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Imię</label>
              <input
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Nazwisko</label>
              <input
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Telefon *</label>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                placeholder="+48..."
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Stanowisko *</label>
              <input
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                placeholder="np. HR Specialist"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-slate-400">Data zatrudnienia *</label>
              <input
                type="date"
                value={newHireDate}
                onChange={(e) => setNewHireDate(e.target.value)}
                onFocus={(e) => e.target.showPicker?.()}
                onClick={(e) => e.target.showPicker?.()}
                className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                required
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={newBusy}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
              >
                {newBusy ? "Zapisywanie…" : "Dodaj"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="card p-3 text-xs text-slate-300">
          Ładowanie pracowników…
        </div>
      )}
      {error && (
        <div className="card p-3 border border-rose-500/40 bg-rose-500/10 text-xs text-rose-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <PagedTable
          rows={filtered}
          emptyText="Brak pracowników do wyświetlenia."
          columns={[
            {
              key: "email",
              header: "Email",
              thClassName: "min-w-[220px]",
              render: (e) => (
                <span className="text-slate-100">
                  {e.user?.email || "[brak]"}
                  <span className="ml-2 text-[10px] text-slate-500">#{e.id}</span>
                </span>
              ),
            },
            {
              key: "name",
              header: "Imię i nazwisko",
              thClassName: "min-w-[180px]",
              render: (e) => {
                const fullName =
                  `${e.user?.first_name || ""} ${e.user?.last_name || ""}`.trim();
                return <span className="text-slate-200">{fullName || "—"}</span>;
              },
            },
            {
              key: "position",
              header: "Stanowisko",
              render: (e) => <span className="text-slate-200">{e.position || "—"}</span>,
            },
            {
              key: "phone",
              header: "Telefon",
              render: (e) => <span className="text-slate-200">{e.phone_number || "—"}</span>,
            },
            {
              key: "hire",
              header: "Zatrudniony od",
              thClassName: "min-w-[120px]",
              render: (e) => <span className="text-slate-300">{e.hire_date || "—"}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (e) => {
                const active = e.user?.is_active ?? true;
                return (
                  <Badge tone={active ? "success" : "danger"}>
                    {active ? "Aktywny" : "Nieaktywny"}
                  </Badge>
                );
              },
            },
            ...(isManager
              ? [
                  {
                    key: "actions",
                    header: "Akcje",
                    thClassName: "min-w-[170px]",
                    render: (e) => (
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(e)}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px]"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => removeEmployee(e)}
                          className="px-3 py-1 rounded-lg border border-rose-500/60 text-rose-200 hover:bg-rose-500/10 text-[11px]"
                        >
                          Usuń
                        </button>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}

      {isManager && editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur p-5 shadow-xl shadow-black/40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">Edycja pracownika</div>
                <div className="text-[11px] text-slate-400">ID: {editId}</div>
              </div>
              <button
                onClick={() => setEditOpen(false)}
                className="text-[11px] px-2 py-1 rounded-lg border border-slate-700 hover:border-emerald-500 hover:text-emerald-300"
              >
                Zamknij
              </button>
            </div>

            {editErr && (
              <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                {editErr}
              </div>
            )}

            <form
              className="grid md:grid-cols-2 gap-3 text-xs"
              onSubmit={saveEdit}
            >
              <div className="flex flex-col gap-1">
                <label className="text-slate-400">Email</label>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400">Aktywny</label>
                <select
                  value={editIsActive ? "1" : "0"}
                  onChange={(e) => setEditIsActive(e.target.value === "1")}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                >
                  <option value="1">Tak</option>
                  <option value="0">Nie</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400">Imię</label>
                <input
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400">Nazwisko</label>
                <input
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400">Telefon</label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400">Stanowisko</label>
                <input
                  value={editPosition}
                  onChange={(e) => setEditPosition(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400">Data zatrudnienia</label>
                <input
                  type="date"
                  value={editHireDate}
                  onChange={(e) => setEditHireDate(e.target.value)}
                  onFocus={(e) => e.target.showPicker?.()}
                  onClick={(e) => e.target.showPicker?.()}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-slate-400">
                  Nowe hasło — opcjonalne
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 outline-none focus:border-emerald-500/60"
                  placeholder="••••••••"
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 hover:border-emerald-500 hover:text-emerald-300 text-xs"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={editBusy}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-60"
                >
                  {editBusy ? "Zapisywanie…" : "Zapisz"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
