function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayKey(dt);
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

export function keyNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayKey(d);
}

export function shortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr;
}

export function calcStreak(daily: Record<string, number>): number {
  const set = new Set(Object.keys(daily));
  let streak = 0;
  const d = new Date();
  if (!set.has(todayKey(d))) {
    d.setDate(d.getDate() - 1);
  }
  while (set.has(todayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
