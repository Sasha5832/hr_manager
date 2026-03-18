import React, { useState } from "react";
import { Line, Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { classNames } from "../utils/classNames";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

export function ChartSwitcher({ title, labels, values, allowPie = true }) {
  const [mode, setMode] = useState("line");

  if (!labels || labels.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <p className="text-xs text-slate-400">
          Brak danych do wyświetlenia wykresu.
        </p>
      </div>
    );
  }

  const data = {
    labels,
    datasets: [
      {
        label: "Frekwencja (%)",
        data: values,
        borderColor: "rgb(16, 185, 129)",
        backgroundColor: "rgba(16, 185, 129, 0.25)",
        tension: 0.3,
      },
    ],
  };

  const commonOptions = {
    responsive: true,
    plugins: {
      legend: { display: allowPie && mode === "pie" ? true : false },
      tooltip: { enabled: true },
    },
    scales:
      allowPie && mode === "pie"
        ? {}
        : {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { stepSize: 10, color: "#cbd5f5" },
            },
            x: {
              ticks: { color: "#cbd5f5" },
            },
          },
  };

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex justify-between items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900/70 p-0.5">
          {(allowPie ? ["line","bar","pie"] : ["line","bar"]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={classNames(
                "px-2 py-0.5 text-[11px] rounded-lg transition",
                mode === m
                  ? "bg-emerald-500 text-slate-950 font-semibold"
                  : "text-slate-300 hover:text-emerald-300",
              )}
            >
              {m === "line" && "Liniowy"}
              {m === "bar" && "Słupkowy"}
              {m === "pie" && "Kołowy"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-1 h-56 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
        {mode === "line" && <Line data={data} options={commonOptions} />}
        {mode === "bar" && <Bar data={data} options={commonOptions} />}
        {allowPie && mode === "pie" && (
          <Pie
            data={{
              labels,
              datasets: [
                {
                  data: values,
                  backgroundColor: [
                    "rgba(16, 185, 129, 0.7)",
                    "rgba(59, 130, 246, 0.7)",
                    "rgba(234, 179, 8, 0.7)",
                    "rgba(249, 115, 22, 0.7)",
                    "rgba(239, 68, 68, 0.7)",
                    "rgba(45, 212, 191, 0.7)",
                  ],
                },
              ],
            }}
            options={commonOptions}
          />
        )}
      </div>
    </div>
  );
}


