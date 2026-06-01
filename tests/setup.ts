const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

export async function apiGet(path: string, options?: { headers?: Record<string, string> }) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

export async function apiPost(path: string, data?: any, options?: { headers?: Record<string, string> }) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

export async function apiPatch(path: string, data?: any, options?: { headers?: Record<string, string> }) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

export async function apiDelete(path: string, options?: { headers?: Record<string, string> }) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body, headers: res.headers };
}

export async function fetchPage(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "text/html" },
  });
  const text = await res.text();
  return { status: res.status, body: text, headers: res.headers };
}
