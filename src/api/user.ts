export interface UserStats {
  learned: number;
  mastered: number;
  wrong: number;
  dueToday: number;
  todayLearned: number;
  streak: number;
  dailyGoal: number;
  last30: { date: string; count: number }[];
  activities: Record<string, { words: number; new: number; wrong: number }>;
}

export interface UserProfile {
  nickname: string;
  bio: string;
  dailyGoal: number;
  avatarColor: string;
  settings: Record<string, unknown>;
  lastActiveAt: string | null;
  createdAt: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = useAuthStore.getState().token || undefined;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    data?: unknown;
    stats?: UserStats;
    profile?: UserProfile;
  } | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || `请求失败（HTTP ${res.status}）`);
  }
  return json as unknown as T;
}

export function apiGetStats(token: string): Promise<{ stats: UserStats }> {
  return request('/api/user/stats', { headers: { Authorization: `Bearer ${token}` } });
}

export function apiGetProfile(token: string): Promise<{ user: { id: string; username: string; createdAt: string | null }; profile: UserProfile }> {
  return request('/api/user/profile', { headers: { Authorization: `Bearer ${token}` } });
}

export function apiPatchProfile(
  token: string,
  patch: Partial<{ nickname: string; bio: string; dailyGoal: number; avatarColor: string; settings: Record<string, unknown> }>,
): Promise<{ profile: UserProfile }> {
  return request('/api/user/profile', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
}

export function apiChangePassword(
  token: string,
  oldPassword: string,
  newPassword: string,
): Promise<{ ok: boolean }> {
  return request('/api/user/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

export function apiClearServerExampleCache(token: string): Promise<{ deleted: number }> {
  return request('/api/example/cache', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
import { useAuthStore } from '../store/auth';
