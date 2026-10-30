import { readToken } from "./auth/storage";

const BASE =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PACKAGER_PROXY_URL ||
  "";

export const API_BASE = `${BASE}/api`;

type FetchOpts = RequestInit & { auth?: boolean };

export async function apiFetch(path: string, opts: FetchOpts = {}) {
  const headers = new Headers(opts.headers || {});
  if (opts.auth !== false) {
    const token = await readToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && opts.body && typeof opts.body === "string") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const ct = res.headers.get("content-type") || "";
  // 204/empty bodies may still carry content-type: application/json -> parse safely
  const raw = res.status === 204 ? "" : await res.text();
  let data: any = raw;
  if (raw && ct.includes("application/json")) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }
  if (!res.ok) {
    const msg =
      (typeof data === "object" && (data as any)?.detail) ||
      (typeof data === "string" ? data : "Erro na requisição");
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

export async function loginRequest(email: string, password: string) {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Erro ao fazer login");
  return data;
}
