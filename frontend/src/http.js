// Backend – trzymamy spójnie localhost (żeby cookies sesji działały stabilnie)
import { ApiError } from "./api";

export const BACKEND_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

// ---------------- CSRF + POST (do Approve/Reject) ----------------

export function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

export async function apiPost(path, payload = null) {
  const url = `${BACKEND_BASE}${path}`;
  await ensureCsrfCookie();
  const csrftoken = getCookie("csrftoken");

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      ...(csrftoken ? { "X-CSRFToken": csrftoken } : {}),
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : null,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.detail || msg;
    } catch {
      // ignore
    }
    throw new ApiError(msg, res.status);
  }

  try {
    return await res.json();
  } catch {
    return {};
  }
}

// ---------------- CSRF + JSON REQUEST (PATCH/DELETE/PUT) ----------------

export async function apiRequest(method, path, payload = null) {
  const url = `${BACKEND_BASE}${path}`;
  await ensureCsrfCookie();
  const csrftoken = getCookie("csrftoken");

  const isFormData =
    typeof FormData !== "undefined" && payload instanceof FormData;

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      ...(csrftoken ? { "X-CSRFToken": csrftoken } : {}),
      ...(payload && !isFormData ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? (isFormData ? payload : JSON.stringify(payload)) : null,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      msg = j?.detail || msg;
    } catch {
      // ignore
    }
    throw new ApiError(msg, res.status);
  }

  // DELETE może zwrócić pustą odpowiedź
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export function apiPatch(path, payload) {
  return apiRequest("PATCH", path, payload);
}

export function apiDelete(path) {
  return apiRequest("DELETE", path);
}

export async function ensureCsrfCookie() {
  // Backend ustawia cookie CSRF; bez tego POST/PUT/PATCH/DELETE mogą zwracać 403.
  if (getCookie("csrftoken")) return;

  try {
    await fetch(`${BACKEND_BASE}/api/csrf/`, {
      method: "GET",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });
  } catch {
    // w trybie offline/bez backendu po prostu pomijamy
  }
}

