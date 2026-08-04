import { useSettingsStore, type Switches } from '../store/settings';
import type { SwitchKey } from '../types';

const DEFS: {
  key: SwitchKey;
  label: string;
  desc: string;
  disabled?: (sw: Switches) => boolean;
}[] = [
  {
    key: 'readMeaning',
    label: '朗读中文释义',
    desc: '自动播放时，每个单词播完英文后朗读中文释义',
  },
  {
    key: 'aiExamples',
    label: 'AI 例句（总开关）',
    desc: '开启后每播完一个单词自动调用大模型生成例句；关闭后零 API 调用',
  },
  {
    key: 'withTranslation',
    label: '例句包含中文翻译',
    desc: '开：英文例句 + 中文翻译 + 近义词辨析；关：只返回英文例句，节省 token',
    disabled: (sw) => !sw.aiExamples,
  },
  {
    key: 'syllables',
    label: '逐音节朗读',
    desc: '自动播放时先逐音节慢读，再整词朗读',
  },
  {
    key: 'showMeaningCard',
    label: '显示中文释义卡片',
    desc: '自动播放界面显示中文释义；关闭后可用于纯听英文自测',
  },
];

export default function SwitchPanel() {
  const switches = useSettingsStore((s) => s.switches);
  const setSwitch = useSettingsStore((s) => s.setSwitch);

  return (
    <div className="space-y-3">
      {DEFS.map((d) => {
        const disabled = d.disabled?.(switches) ?? false;
        const on = switches[d.key];
        return (
          <div
            key={d.key}
            data-switch={d.key}
            className={`flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800 ${
              disabled ? 'opacity-50' : ''
            }`}
          >
            <button
              type="button"
              role="switch"
              aria-checked={on && !disabled}
              disabled={disabled}
              onClick={() => {
                setSwitch(d.key, !on);
              }}
              className={`mt-0.5 h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                on && !disabled
                  ? 'bg-emerald-500'
                  : 'bg-slate-300 dark:bg-slate-600'
              } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  on && !disabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{d.label}</div>
              <div className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {d.desc}
              </div>
              {disabled && (
                <div className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  需先开启「AI 例句」总开关
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
