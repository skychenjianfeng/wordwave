import { useEffect, useState } from 'react';
import type { PageId } from './types';
import { useWordsStore } from './store/words';
import { useSettingsStore } from './store/settings';
import { useToastStore } from './store/toast';
import { useGlobalKeys } from './hooks/useGlobalKeys';
import { initSpeech } from './lib/speech';
import Toaster from './components/Toaster';
import AuthModal from './components/AuthModal';
import { useAuthStore } from './store/auth';
import { apiLogout, apiMe, apiPutProgress } from './api/auth';
import { useProgressStore } from './store/progress';
import StudyPage from './pages/StudyPage';
import AutoplayPage from './pages/AutoplayPage';
import ReviewPage from './pages/ReviewPage';
import QuizPage from './pages/QuizPage';
import StatsPage from './pages/StatsPage';
import WordListPage from './pages/WordListPage';
import DataPage from './pages/DataPage';
import PersonalPage from './pages/PersonalPage';
import SettingsPage from './pages/SettingsPage';

const NAV: { id: PageId; label: string; icon: string }[] = [
  { id: 'study', label: '学习', icon: '📖' },
  { id: 'autoplay', label: '自动播放', icon: '▶️' },
  { id: 'review', label: '复习', icon: '🔁' },
  { id: 'quiz', label: '测验', icon: '📝' },
  { id: 'stats', label: '统计', icon: '📊' },
  { id: 'list', label: '词库', icon: '🗂️' },
  { id: 'data', label: '数据', icon: '💾' },
  { id: 'personal', label: '个人', icon: '🧑‍🎓' },
  { id: 'settings', label: '设置', icon: '⚙️' },
];

export default function App() {
  const [page, setPage] = useState<PageId>('study');

  const words = useWordsStore((s) => s.words);
  const loading = useWordsStore((s) => s.loading);
  const error = useWordsStore((s) => s.error);
  const load = useWordsStore((s) => s.load);

  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const rate = useSettingsStore((s) => s.rate);
  const setRate = useSettingsStore((s) => s.setRate);
  const showToast = useToastStore((s) => s.show);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    initSpeech();
    if (words.length === 0 && !loading && !error) void load();
  }, [load, loading, error, words.length]);

  useEffect(() => {
    if (words.length > 0) {
      (window as unknown as { __wwWordsLoaded?: boolean }).__wwWordsLoaded = true;
    }
  }, [words.length]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // 校验本地保存的登录态
  useEffect(() => {
    const st = useAuthStore.getState();
    if (!st.token || !st.user) return;
    const savedToken = st.token;
    apiMe(savedToken)
      .then((me) => setAuth(savedToken, me))
      .catch(() => clearAuth());
  }, [setAuth, clearAuth]);

  // 登录后学习进度自动上传（2 秒防抖）
  useEffect(() => {
    if (!token) return;
    let timer: number | undefined;
    const unsub = useProgressStore.subscribe((state, prev) => {
      if (state.records === prev.records && state.dailyWords === prev.dailyWords) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void apiPutProgress(token, {
          records: state.records as never,
          dailyWords: state.dailyWords,
        }).catch(() => {});
      }, 2000);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, [token]);

  const doLogout = async () => {
    if (token) await apiLogout(token).catch(() => {});
    clearAuth();
    showToast('已退出登录', 'info');
  };

  useGlobalKeys(
    (e) => {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const r = Math.min(5, Math.round((rate + 0.1) * 100) / 100);
        setRate(r);
        showToast(`语速 ${r.toFixed(2)}x`, 'info');
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const r = Math.max(0.1, Math.round((rate - 0.1) * 100) / 100);
        setRate(r);
        showToast(`语速 ${r.toFixed(2)}x`, 'info');
      }
    },
    [rate, setRate, showToast],
  );

  let body: React.ReactNode;
  if (loading && words.length === 0) {
    body = (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-sm">正在加载 5530 个考研词汇…</p>
      </div>
    );
  } else if (error && words.length === 0) {
    body = (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <div className="text-4xl">😵</div>
        <p className="mt-3 font-semibold text-rose-500">词库加载失败</p>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white"
        >
          重试
        </button>
      </div>
    );
  } else {
    body = (
      <>
        {page === 'study' && <StudyPage />}
        {page === 'autoplay' && <AutoplayPage />}
        {page === 'review' && <ReviewPage />}
        {page === 'quiz' && <QuizPage />}
        {page === 'stats' && <StatsPage />}
        {page === 'list' && <WordListPage />}
        {page === 'data' && <DataPage />}
        {page === 'personal' && <PersonalPage />}
        {page === 'settings' && <SettingsPage />}
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-2xl">🌊</span>
            <div className="hidden leading-tight sm:block">
              <div className="text-base font-extrabold tracking-wide">
                Word<span className="text-emerald-500">Wave</span>
              </div>
              <div className="text-[10px] text-slate-400">词浪 · 考研英语</div>
            </div>
          </div>

          <nav className="ml-1 flex flex-1 gap-1 overflow-x-auto py-1 sm:ml-3">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setPage(n.id)}
                className={`whitespace-nowrap rounded-xl px-2.5 py-1.5 text-sm font-semibold transition-colors sm:px-3 ${
                  page === n.id
                    ? 'bg-emerald-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <span className="sm:mr-1">{n.icon}</span>
                <span className="hidden sm:inline">{n.label}</span>
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <span
                  className="hidden max-w-[110px] truncate rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300 sm:inline"
                  title={user.username}
                >
                  👤 {user.username}
                </span>
                <button
                  type="button"
                  onClick={() => void doLogout()}
                  className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  退出
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="rounded-xl bg-sky-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-600"
              >
                登录
              </button>
            )}
            <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-emerald-600 dark:bg-slate-800 dark:text-emerald-400 md:inline">
              {rate.toFixed(2)}x
            </span>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl bg-slate-100 px-2.5 py-1.5 text-lg hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
              aria-label="切换主题"
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
          </div>
        </div>
      </header>

      <main>{body}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-center text-xs text-slate-400">
        WordWave 词浪 · 多词库学习平台 · Django + MySQL + Redis · 发音与音节切分基于 Web Speech API + hyphen
      </footer>

      <Toaster />
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
    </div>
  );
}
