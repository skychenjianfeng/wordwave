export interface AuthUser {
  id: string;
  username: string;
  createdAt: string;
}

export interface ProgressPayload {
  records: Record<string, unknown>;
  dailyWords: Record<string, string[]>;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    token?: string;
    user?: AuthUser;
    data?: ProgressPayload;
  } | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `请求失败（HTTP ${res.status}）`);
  }
  return json as unknown as T;
}

export function apiRegister(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function apiLogin(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function apiLogout(token: string): Promise<void> {
  return request('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function apiMe(token: string): Promise<AuthUser> {
  return request<{ user: AuthUser }>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.user);
}

export async function apiGetProgress(token: string): Promise<ProgressPayload | null> {
  const r = await request<{ data?: ProgressPayload }>('/api/user/progress', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = r.data;
  if (data && data.records && Object.keys(data.records).length > 0) return data;
  return null;
}

export function apiPutProgress(token: string, payload: ProgressPayload): Promise<void> {
  return request('/api/user/progress', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}
