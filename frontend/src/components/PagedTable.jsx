import React, { useEffect, useMemo, useState } from "react";

/**
 * Tabela z paginacją i "sticky" nagłówkiem.
 * Cel: wygodne przeglądanie dużej liczby rekordów bez renderowania tysięcy wierszy naraz.
 */
export function PagedTable({
  rows,
  columns,
  getRowKey,
  emptyText = "Brak danych do wyświetlenia.",
  initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  maxHeightClass = "max-h-[70vh]",
  className = "",
}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Gdy zmieniają się dane (np. filtr), wracamy na 1 stronę.
  useEffect(() => {
    setPage(1);
  }, [safeRows]);

  const totalRows = safeRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);

  const pageRows = useMemo(() => {
    return safeRows.slice(startIdx, endIdx);
  }, [safeRows, startIdx, endIdx]);

  return (
    <div className={`card overflow-hidden ${className}`.trim()}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/40">
        <div className="text-[11px] text-slate-400">
          {totalRows > 0 ? (
            <>
              Wyniki <span className="text-slate-200">{startIdx + 1}</span>–
              <span className="text-slate-200">{endIdx}</span> z{" "}
              <span className="text-slate-200">{totalRows}</span>
            </>
          ) : (
            <>{emptyText}</>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[11px] text-slate-400">Na stronę</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) || initialPageSize);
              setPage(1);
            }}
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] outline-none focus:border-emerald-500/60"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
            <button
              onClick={() => setPage(1)}
              disabled={safePage <= 1}
              className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900/40 disabled:opacity-50"
              title="Pierwsza"
            >
              «
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900/40 disabled:opacity-50"
              title="Poprzednia"
            >
              ‹
            </button>
            <div className="px-2 py-1 text-[11px] text-slate-300 border-x border-slate-800">
              {safePage} / {pageCount}
            </div>
            <button
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900/40 disabled:opacity-50"
              title="Następna"
            >
              ›
            </button>
            <button
              onClick={() => setPage(pageCount)}
              disabled={safePage >= pageCount}
              className="px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-900/40 disabled:opacity-50"
              title="Ostatnia"
            >
              »
            </button>
          </div>
        </div>
      </div>

      <div className={`${maxHeightClass} overflow-auto`}>
        <table className="w-full text-xs">
          <thead className="bg-slate-900/90 text-slate-300 sticky top-0 z-10">
            <tr className="border-b border-slate-800">
              {columns.map((c, idx) => (
                <th
                  key={c.key || idx}
                  className={`px-3 py-2 text-left font-medium ${c.thClassName || ""}`.trim()}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pageRows.map((r, i) => (
              <tr
                key={getRowKey ? getRowKey(r) : r?.id ?? i}
                className="border-b border-slate-900/70 hover:bg-slate-900/40"
              >
                {columns.map((c, idx) => (
                  <td
                    key={c.key || idx}
                    className={`px-3 py-2 align-middle ${c.tdClassName || ""}`.trim()}
                  >
                    {c.render ? c.render(r) : ""}
                  </td>
                ))}
              </tr>
            ))}

            {totalRows === 0 && (
              <tr>
                <td
                  colSpan={Math.max(1, columns.length)}
                  className="px-3 py-4 text-center text-slate-400"
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
