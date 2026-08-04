import { useRef } from 'react';
import { useProgressStore } from '../store/progress';
import { useExampleCacheStore } from '../store/exampleCache';
import { DEFAULT_SWITCHES, useSettingsStore } from '../store/settings';
import { useToastStore } from '../store/toast';
import { todayKey } from '../lib/dates';
import { useAuthStore } from '../store/auth';
import { apiLogout } from '../api/auth';

export default function DataPage() {
  const exportJson = useProgressStore((s) => s.exportJson);
  const importJson = useProgressStore((s) => s.importJson);
  const resetProgress = useProgressStore((s) => s.resetProgress);
  const cacheSize = useExampleCacheStore((s) => s.order.length);
  const clearCache = useExampleCacheStore((s) => s.clear);
  const showToast = useToastStore((s) => s.show);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wordwave-backup-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('学习数据备份已导出', 'success');
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      if (importJson(text)) showToast('导入成功，学习进度已恢复', 'success');
      else showToast('导入失败：文件格式不正确', 'error');
    } catch {
      showToast('导入失败：无法读取文件', 'error');
    }
  };

  const resetAll = () => {
    if (!window.confirm('确定清空全部学习进度、例句缓存与设置？此操作不可恢复！')) return;
    resetProgress();
    clearCache();
    useSettingsStore.setState({
      theme: 'light',
      rate: 1,
      switches: { ...DEFAULT_SWITCHES },
    });
    showToast('已重置全部数据', 'success');
  };

  const card = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800';

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h2 className="mb-4 text-xl font-bold">数据管理</h2>
      <div className="space-y-4">
        <div className={card}>
          <h3 className="font-bold">👤 账号</h3>
          {user ? (
            <>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                当前账号：<span className="font-semibold text-sky-600 dark:text-sky-400">{user.username}</span>
                <br />
                学习进度已开启云端同步：操作后自动上传，登录其他设备即可恢复。
              </p>
              <button
                type="button"
                onClick={async () => {
                  if (token) await apiLogout(token).catch(() => {});
                  clearAuth();
                  showToast('已退出登录', 'info');
                }}
                className="mt-3 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                退出登录
              </button>
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              未登录（游客模式）：数据仅保存在本机浏览器。
              <br />
              点击右上角「登录」注册账号后，学习进度可跨设备同步。
            </p>
          )}
        </div>

        <div className={card}>
          <h3 className="font-bold">💾 导出 / 导入学习数据</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            学习进度、SM-2 复习记录、错词本与音节笔记全部保存在浏览器 localStorage，
            可导出 JSON 备份，换设备后导入恢复。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={doExport}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600"
            >
              导出备份
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600"
            >
              导入备份
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImport(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className={card}>
          <h3 className="font-bold">🧠 AI 例句本地缓存</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            缓存 key 同时包含单词与「是否带中文翻译」两个维度，两种模式各存一份，
            切换开关不会重复请求。当前缓存 {cacheSize} 条（上限 300 条，自动淘汰最旧）。
          </p>
          <button
            type="button"
            onClick={() => {
              clearCache();
              showToast('例句缓存已清空', 'success');
            }}
            className="mt-3 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            清空例句缓存
          </button>
        </div>

        <div className={`${card} border-rose-200 dark:border-rose-900`}>
          <h3 className="font-bold text-rose-500">⚠️ 危险区</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                if (!window.confirm('确定清空全部学习进度（含笔记）？此操作不可恢复！')) return;
                resetProgress();
                showToast('学习进度已重置', 'success');
              }}
              className="rounded-xl bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-300"
            >
              重置学习进度
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600"
            >
              重置全部数据
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
