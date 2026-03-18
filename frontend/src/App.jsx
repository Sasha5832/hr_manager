import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { apiGet } from "./api";
import { AuthContext } from "./context/AuthContext";
import { Shell } from "./layout/Shell";

import DashboardPage from "./pages/DashboardPage";
import LeavesPage from "./pages/LeavesPage";
import PerformancePage from "./pages/PerformancePage";
import AttendancePage from "./pages/AttendancePage";
import EmployeesPage from "./pages/EmployeesPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  const [isAuthed, setIsAuthed] = useState(null);
  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        await apiGet("/api/me/");
        setIsAuthed(true);
      } catch {
        setIsAuthed(false);
      }
    }
    check();
  }, []);

  if (isAuthed === null) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ isAuthed, setIsAuthed, isManager, setIsManager }}
    >
      {isAuthed ? (
        <Shell>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/leave" element={<LeavesPage />} />
            <Route path="/performance" element={<PerformancePage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </AuthContext.Provider>
  );
}
