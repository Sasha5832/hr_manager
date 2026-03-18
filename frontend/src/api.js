// frontend/src/api.js

export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "")

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

function normalizeList(data) {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.results)) return data.results
  return []
}

export async function apiGet(path) {
  const url = `${API_BASE}${path}`

  const resp = await fetch(url, {
    credentials: "include",
  })

  if (!resp.ok) {
    let detail = ""
    try {
      const data = await resp.json()
      detail = data && data.detail ? ` – ${data.detail}` : ""
    } catch {
      // ignore
    }
    throw new ApiError(detail || `HTTP ${resp.status}`, resp.status)
  }

  return resp.json()
}

export { normalizeList }
