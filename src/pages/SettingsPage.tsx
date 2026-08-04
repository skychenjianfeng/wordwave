import { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useSettingsStore } from '../store/settings';
import { useWordsStore } from '../store/words';
import { useProgressStore } from '../store/progress';
import { useExampleCacheStore } from '../store/exampleCache';
import { useToastStore } from '../store/toast';
import { apiLogout } from '../api/auth';
import {
  apiChangePassword,
  apiClearServerExampleCache,
  apiGetProfile,
  apiPatchProfile,
} from '../api/user';
import { syncProgressAfterLogin } from '../lib/sync';
import RateControl from '../components/RateControl';
import AccentControl from '../components/AccentControl';
import SwitchPanel from '../components/SwitchPanel';
import { EXAMPLE_STYLES } from '../lib/exampleStyles';
import type { ExampleStyle } from '../types';

export default function SettingsPage() {
  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const exampleStyle = useSettingsStore((s) => s.exampleStyle);
  const setExampleStyle = useSettingsStore((s) => s.setExampleStyle);
  const dailyGoal = useSettingsStore((s) => s.dailyGoal);
  const setDailyGoal = useSettingsStore((s) => s.setDailyGoal);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const showToast = useToastStore((s) => s.show);
  const dicts = useWordsStore((s) => s.dicts);
  const activeDictId = useWordsStore((s) => s.activeDictId);
  const setActiveDict = useWordsStore((s) => s.setActiveDict);
  const exportJson = useProgressStore((s) => s.exportJson);
  const importJson = useProgressStore((s) => s.importJson);
  const cacheSize = useExampleCacheStore((s) => s.order.length);
  const clearCache = useExampleCacheStore((s) => s.clear);

  const [nickname, setNickname] = useState(user?.username ?? '');
  const [bio, setBio] = useState('');
  const [goal, setGoal] = useState(dailyGoal);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  const card = 'rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800';

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wordwave-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('学习数据备份已导出', 'success');
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      if (importJson(text)) {
        showToast('导入成功', 'success');
        if (token) await syncProgressAfterLogin(token).catch(() => {});
      } else showToast('导入失败：文件格式不正确', 'error');
    } catch {
      showToast('导入失败：无法读取文件', 'error');
    }
  };

  const saveProfile = async () => {
    if (!token) return;
    try {
      await apiPatchProfile(token, {
        nickname: nickname.trim() || undefined,
        bio: bio.trim() || undefined,
        dailyGoal: goal,
      });
      setDailyGoal(goal);
      showToast('个人资料已保存', 'success');
    } catch (e) {
      showToast(`保存失败：${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };

  const loadProfile = async () => {
    if (!token) return;
    try {
      const r = await apiGetProfile(token);
      setNickname(r.profile.nickname);
      setBio(r.profile.bio);
      setGoal(r.profile.dailyGoal);
    } catch {
      // 忽略：游客模式
    }
  };

  const changePwd = async () => {
    if (!token) return;
    setPwdBusy(true);
    try {
      await apiChangePassword(token, oldPwd, newPwd);
      showToast('密码修改成功', 'success');
      setOldPwd('');
      setNewPwd('');
    } catch (e) {
      showToast(`修改失败：${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setPwdBusy(false);
    }
  };

  const clearAllCaches = async () => {
    clearCache();
    if (token) {
      try {
        const r = await apiClearServerExampleCache(token);
        showToast(`本地与云端例句缓存已清空（云端 ${r.deleted} 条）`, 'success');
        return;
      } catch {
        // 云端失败仍提示本地已清空
      }
    }
    showToast('本地例句缓存已清空', 'success');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h2 className="mb-4 text-xl font-bold">设置中心</h2>
      <div className="space-y-4">
        <div className={card}>
          <h3 className="font-bold">🌗 外观与发音</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              {theme === 'light' ? '🌙 切换到深色' : '☀️ 切换到浅色'}
            </button>
            <span className="text-xs text-slate-400">当前主题：{theme === 'light' ? '浅色' : '深色'}</span>
          </div>
          <div className="mt-3"><RateControl /></div>
          <div className="mt-3"><AccentControl /></div>
        </div>

        <div className={card}>
          <h3 className="font-bold">🎛️ 播放与 AI 例句</h3>
          <div className="mt-3">
            <div className="text-sm font-semibold">例句风格</div>
            <select
              value={exampleStyle}
              onChange={(e) => setExampleStyle(e.target.value as ExampleStyle)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            >
              {EXAMPLE_STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <SwitchPanel />
          </div>
        </div>

        <div className={card}>
          <h3 className="font-bold">🗂️ 词典管理</h3>
          <p className="mt-1 text-xs text-slate-400">
            切换默认词库（学习、复习、测验、自动播放均使用当前词库）
          </p>
          <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {dicts.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="truncate font-semibold">{d.name}</span>
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    {d.difficulty}
                  </span>
                  <span className="ml-1 font-mono text-xs text-slate-400">{d.count.toLocaleString()} 词</span>
                </div>
                <button
                  type="button"
                  disabled={d.id === activeDictId}
                  onClick={() => void setActiveDict(d.id)}
                  className={`shrink-0 rounded-lg px-3 py-1 text-xs font-bold ${
                    d.id === activeDictId
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {d.id === activeDictId ? '使用中' : '切换'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <h3 className="font-bold">👤 账号与资料</h3>
          {user && token ? (
            <div className="mt-3 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-500">昵称</span>
                  <input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">每日目标</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={goal}
                    onChange={(e) => setGoal(parseInt(e.target.value, 10) || 20)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="text-slate-500">个人简介</span>
                <input
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="一句话介绍自己（选填）"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveProfile()}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
                >
                  保存资料
                </button>
                <button
                  type="button"
                  onClick={() => void loadProfile()}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  重新拉取
                </button>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                <div className="text-sm font-semibold">修改密码</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    type="password"
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                    placeholder="原密码"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="新密码（6-64 位）"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-slate-600 dark:bg-slate-800"
                  />
                </div>
                <button
                  type="button"
                  disabled={pwdBusy || !oldPwd || !newPwd}
                  onClick={() => void changePwd()}
                  className="mt-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  {pwdBusy ? '提交中…' : '修改密码'}
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (token) await apiLogout(token).catch(() => {});
                  clearAuth();
                  showToast('已退出登录', 'info');
                }}
                className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-900/30 dark:text-rose-300"
              >
                退出登录
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              未登录（游客模式）：设置仅保存在本机。注册账号后可同步学习进度与个人资料。
            </p>
          )}
        </div>

        <div className={card}>
          <h3 className="font-bold">💾 数据与缓存</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={doExport}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
            >
              导出学习数据（JSON）
            </button>
            <label className="cursor-pointer rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600">
              导入备份
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void doImport(f);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void clearAllCaches()}
              className="rounded-xl bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300"
            >
              清空例句缓存（本地 {cacheSize} 条）
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            AI 例句采用「单词 + 翻译模式 + 风格」三维缓存：切换开关/风格不会重复请求；清空后下次播放会重新生成。
          </p>
        </div>
      </div>
    </div>
  );
}
