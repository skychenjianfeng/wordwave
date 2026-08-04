import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useWordsStore } from '../store/words';
import { useProgressStore } from '../store/progress';
import { useSettingsStore } from '../store/settings';
import { calcStreak, lastNDays, shortDate, todayKey } from '../lib/dates';

export default function StatsPage() {
  const words = useWordsStore((s) => s.words);
  const records = useProgressStore((s) => s.records);
  const dailyWords = useProgressStore((s) => s.dailyWords);
  const theme = useSettingsStore((s) => s.theme);

  const stats = useMemo(() => {
    const learned = words.filter((w) => records[w.word]?.learnedAt).length;
    const mastered = words.filter((w) => records[w.word]?.status === 'mastered').length;
    const wrong = words.filter((w) => (records[w.word]?.wrongCount ?? 0) > 0).length;
    const dailyCounts: Record<string, number> = {};
    for (const [k, v] of Object.entries(dailyWords)) dailyCounts[k] = v.length;
    const streak = calcStreak(dailyCounts);
    const dueToday = words.filter((w) => {
      const r = records[w.word]?.review;
      return !!r && r.nextReview <= todayKey();
    }).length;
    const daily = lastNDays(30).map((d) => ({
      date: shortDate(d),
      count: dailyCounts[d] ?? 0,
    }));

    const catMap = new Map<string, { total: number; mastered: number; learned: number }>();
    for (const w of words) {
      const cur = catMap.get(w.category) ?? { total: 0, mastered: 0, learned: 0 };
      cur.total += 1;
      const rec = records[w.word];
      if (rec?.status === 'mastered') cur.mastered += 1;
      if (rec?.learnedAt) cur.learned += 1;
      catMap.set(w.category, cur);
    }
    const categories = Array.from(catMap.entries())
      .map(([name, v]) => ({
        name,
        total: v.total,
        mastered: v.mastered,
        learned: v.learned,
        rate: v.total ? Math.round((v.mastered / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return { learned, mastered, wrong, streak, dueToday, daily, categories };
  }, [words, records, dailyWords]);

  const tickColor = theme === 'dark' ? '#cbd5e1' : '#64748b';
  const gridColor = theme === 'dark' ? '#334155' : '#cbd5e1';

  const cards = [
    { label: '已学单词', value: stats.learned, icon: '📖', color: 'text-sky-500' },
    { label: '已掌握', value: stats.mastered, icon: '🏅', color: 'text-emerald-500' },
    { label: '错词', value: stats.wrong, icon: '❗', color: 'text-rose-500' },
    { label: '连续学习天数', value: stats.streak, icon: '🔥', color: 'text-orange-500' },
    { label: '今日待复习', value: stats.dueToday, icon: '🔁', color: 'text-violet-500' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h2 className="mb-4 text-xl font-bold">学习统计</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-center dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="text-2xl">{c.icon}</div>
            <div className={`mt-1 text-3xl font-extrabold ${c.color}`}>{c.value}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-2 text-sm font-bold">近 30 天学习量</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stats.daily} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: tickColor }} interval={4} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tickColor }} width={40} />
            <Tooltip
              cursor={{ fill: 'rgba(148,163,184,0.15)' }}
              contentStyle={{
                background: theme === 'dark' ? '#1e293b' : '#fff',
                border: '1px solid #64748b',
                borderRadius: 12,
                fontSize: 13,
              }}
            />
            <Bar dataKey="count" name="学习单词数" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-2 text-sm font-bold">分类掌握度（前 8 大分类）</h3>
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={stats.categories} outerRadius="72%">
            <PolarGrid stroke={gridColor} opacity={0.6} />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 12, fill: tickColor }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: tickColor }} />
            <Radar
              name="掌握度 %"
              dataKey="rate"
              stroke="#0ea5e9"
              fill="#0ea5e9"
              fillOpacity={0.35}
            />
            <Tooltip
              contentStyle={{
                background: theme === 'dark' ? '#1e293b' : '#fff',
                border: '1px solid #64748b',
                borderRadius: 12,
                fontSize: 13,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
        <p className="mt-1 text-center text-xs text-slate-400">
          掌握度 = 该分类中「已掌握」单词占比（SM-2 连续两次高质量复习或学习 3 次以上）
        </p>
      </div>
    </div>
  );
}
