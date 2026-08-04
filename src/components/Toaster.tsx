import { useToastStore } from '../store/toast';

const STYLES = {
  info: 'bg-slate-800 text-white dark:bg-slate-700',
  success: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl px-4 py-2 text-sm font-medium shadow-lg ${STYLES[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
