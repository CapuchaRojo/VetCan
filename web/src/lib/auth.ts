const DEV_TOKEN_KEY = "vetcan.devToken";

export function getAuthToken(): string | null {
  return localStorage.getItem(DEV_TOKEN_KEY);
}

export function setAuthToken(token: string) {
  localStorage.setItem(DEV_TOKEN_KEY, token);
}

export async function initDevAuth() {
  if (!import.meta.env.DEV) return;
  if (getAuthToken()) return;

  try {
    const res = await fetch("/api/auth/dev-token", { method: "POST" });
    if (!res.ok) return;
    const data: { token?: string } = await res.json();
    if (data.token) {
      setAuthToken(data.token);
    }
  } catch {
    // silent
  }
}
