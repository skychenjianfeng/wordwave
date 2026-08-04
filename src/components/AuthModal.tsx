import { useState } from 'react';
import { apiLogin, apiRegister } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useToastStore } from '../store/toast';
import { syncProgressAfterLogin } from '../lib/sync';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const showToast = useToastStore((s) => s.show);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === 'register'
          ? await apiRegister(username.trim(), password)
          : await apiLogin(username.trim(), password);
      setAuth(res.token, res.user);
      showToast(`欢迎回来，${res.user.username}！`, 'success');
      setUsername('');
      setPassword('');
      onClose();
      void syncProgressAfterLogin(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 dark:border-slate-600 dark:bg-slate-800';

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{mode === 'login' ? '登录' : '注册账号'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-bold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              mode === 'login'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              mode === 'register'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
            }`}
          >
            注册账号
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名（2-20 位，可中文）"
            className={inputCls}
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少 6 位）"
            className={inputCls}
          />
          {error && (
            <div className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {loading ? '请稍候…' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          游客模式的数据仅保存在本机浏览器；
          <br />
          登录后学习进度自动同步到服务器（跨设备可用）
        </p>
      </div>
    </div>
  );
}
