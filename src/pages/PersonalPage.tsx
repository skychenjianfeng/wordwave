import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useProgressStore } from '../store/progress';
import { useSettingsStore } from '../store/settings';
import { useWordsStore } from '../store/words';
import { useToastStore } from '../store/toast';
import { apiGetStats, apiPatchProfile, type UserStats } from '../api/user';
import { syncProgressAfterLogin } from '../lib/sync';
import { todayKey, keyNDaysAgo } from '../lib/dates';

function localStats(records: Record<string, { status?: string; wrongCount?: number; review?: { nextReview?: string } | null }>, dailyWords: Record<string, string[]>) {
  const today = todayKey();
  const learned = Object.keys(records).length;
  const mastered = Object.values(records).filter((r) => r?.status === 'mastered').length;
  const wrong = Object.values(records).filter((r) => (r?.wrongCount ?? 0) > 0).length;
  const dueToday = Object.values(records).filter(
    (r) => r?.review?.nextReview && r.review.nextReview <= today,
  ).length;
  const todayLearned = dailyWords[today]?.length ?? 0;
  let streak = 0;
  const days = new Set(Object.keys(dailyWords).filter((d) => (dailyWords[d]?.length ?? 0) > 0));
  let cursor = new Date();
  if (!days.has(todayKey()) && days.has(keyNDaysAgo(1))) cursor = new Date(Date.now() - 86400000);
  while (days.has(todayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  return { learned, mastered, wrong, dueToday, todayLearned, streak, days };
}

export default function PersonalPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const records = useProgressStore((s) => s.records);
  const dailyWords = useProgressStore((s) => s.dailyWords);
  const dailyGoal = useSettingsStore((s) => s.dailyGoal);
  const setDailyGoal = useSettingsStore((s) => s.setDailyGoal);
  const dicts = useWordsStore((s) => s.dicts);
  const activeDictId = useWordsStore((s) => s.activeDictId);
  const words = useWordsStore((s) => s.words);
  const showToast = useToastStore((s) => s.show);
  const [remote, setRemote] = useState<UserStats | null>(null);
  const [syncing, setSyncing] = useState(false);

  const local = useMemo(
    () => localStats(records as never, dailyWords),
    [records, dailyWords],
  );

  useEffect(() => {
    if (!token) return;
    apiGetStats(token)
      .then((r) => setRemote(r.stats))
      .catch(() => {});
  }, [token, local.learned]);

  const stats = remote ?? local;
  const heatmap = useMemo(() => {
    const out: { date: string; count: number }[] = [];
    for (let i = 69; i >= 0; i -= 1) {
      const d = keyNDaysAgo(i);
      out.push({ date: d, count: dailyWords[d]?.length ?? 0 });
    }
    return out;
  }, [dailyWords]);

  const recent = useMemo(() => {
    const out: { date: string; count: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const d = keyNDaysAgo(i);
      out.push({ date: d, count: dailyWords[d]?.length ?? 0 });
    }
    return out;
  }, [dailyWords]);

  const sync = async () => {
    if (!token) {
      showToast('请先登录后再同步', 'info');
      return;
    }
    setSyncing(true);
    try {
      await syncProgressAfterLogin(token);
      const r = await apiGetStats(token);
      setRemote(r.stats);
      showToast('同步完成', 'success');
    } catch (e) {
      showToast(`同步失败：${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setSyncing(false);
    }
  };

  const saveGoal = async (goal: number) => {
    setDailyGoal(goal);
    if (token) {
      apiPatchProfile(token, { dailyGoal: goal }).catch(() => {});
    }
  };

  const card = 'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800';
  const numCls = 'text-2xl font-extrabold';
  const dayLabel = (d: string) => {
    const dt = new Date(`${d}T00:00:00`);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">个人学习中心</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {user ? `欢迎回来，${user.username}` : '游客模式：数据仅保存在本机浏览器'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sync()}
          disabled={syncing}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50"
        >
          {syncing ? '同步中…' : '立即同步进度'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: '已学单词', value: stats.learned, cls: 'text-emerald-500' },
          { label: '已掌握', value: stats.mastered, cls: 'text-sky-500' },
          { label: '错词', value: stats.wrong, cls: 'text-rose-500' },
          { label: '今日待复习', value: stats.dueToday, cls: 'text-amber-500' },
          { label: '今日已学', value: stats.todayLearned, cls: 'text-violet-500' },
          { label: '连续天数', value: stats.streak, cls: 'text-orange-500' },
        ].map((s) => (
          <div key={s.label} className={card}>
            <div className={`${numCls} ${s.cls}`}>{s.value}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold">打卡热力图（近 70 天）</h3>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              少
              {[0, 1, 2, 5, 10].map((n) => (
                <span
                  key={n}
                  className="h-3 w-3 rounded-sm border border-slate-200 dark:border-slate-600"
                  style={{
                    backgroundColor:
                      n === 0
                        ? 'transparent'
                        : n === 1
                          ? 'rgba(16,185,129,0.25)'
                          : n === 2
                            ? 'rgba(16,185,129,0.5)'
                            : n === 5
                              ? 'rgba(16,185,129,0.75)'
                              : '#10b981',
                  }}
                />
              ))}
              多
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[repeat(10,1fr)] gap-1">
            {heatmap.map((d) => (
              <div
                key={d.date}
                title={`${d.date}：${d.count} 词`}
                className="aspect-square rounded-sm border border-slate-100 dark:border-slate-700"
                style={{
                  backgroundColor:
                    d.count === 0
                      ? 'transparent'
                      : d.count <= 2
                        ? 'rgba(16,185,129,0.25)'
                        : d.count <= 5
                          ? 'rgba(16,185,129,0.5)'
                          : d.count <= 10
                            ? 'rgba(16,185,129,0.75)'
                            : '#10b981',
                }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">方块颜色越深，当天学习量越大；悬停查看日期与数量。</p>
        </div>

        <div className={card}>
          <h3 className="font-bold">每日目标</h3>
          <div className="mt-3 flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={200}
              step={5}
              value={dailyGoal}
              onChange={(e) => saveGoal(parseInt(e.target.value, 10))}
              className="flex-1 accent-emerald-500"
            />
            <span className="w-16 text-center font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {dailyGoal}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[10, 20, 30, 50, 100].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => saveGoal(n)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                  dailyGoal === n
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {n} 词/天
              </button>
            ))}
          </div>
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">词库概览</h4>
            <div className="mt-2 space-y-1.5">
              {dicts.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-600 dark:text-slate-300">
                    {d.name}
                    {d.id === activeDictId && (
                      <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                        当前
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-slate-400">{d.count.toLocaleString()}</span>
                </div>
              ))}
              {dicts.length > 8 && (
                <p className="text-xs text-slate-400">…共 {dicts.length} 个词库（在“设置 → 词典管理”查看全部）</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h3 className="font-bold">最近学习记录</h3>
          <div className="mt-3 space-y-2">
            {recent.map((r) => (
              <div key={r.date} className="flex items-center gap-3 text-sm">
                <span className="w-14 shrink-0 font-mono text-xs text-slate-400">{dayLabel(r.date)}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${Math.min(100, (r.count / Math.max(dailyGoal, 1)) * 100)}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-slate-500">{r.count} 词</span>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <h3 className="font-bold">当前词库进度</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            当前词库：<span className="font-semibold text-emerald-600 dark:text-emerald-400">{dicts.find((d) => d.id === activeDictId)?.name ?? activeDictId}</span>
          </p>
          <div className="mt-3">
            {words.length > 0 && (
              <>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>本词库已学 {stats.learned} 词</span>
                  <span>共 {words.length.toLocaleString()} 词</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500"
                    style={{ width: `${Math.min(100, (stats.learned / words.length) * 100)}%` }}
                  />
                </div>
              </>
            )}
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              💡 小贴士：坚持每天完成目标即可保持连续学习记录；错词会自动进入错词本，可在“复习”页统一攻克。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
