import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ExampleStyle, SwitchKey } from '../types';

export interface Switches {
  readMeaning: boolean;
  aiExamples: boolean;
  withTranslation: boolean;
  syllables: boolean;
  showMeaningCard: boolean;
}

export const DEFAULT_SWITCHES: Switches = {
  readMeaning: true,
  aiExamples: false,
  withTranslation: true,
  syllables: true,
  showMeaningCard: true,
};

export type Accent = 'us' | 'uk';

interface SettingsState {
  theme: 'light' | 'dark';
  rate: number;
  accent: Accent;
  exampleStyle: ExampleStyle;
  dailyGoal: number;
  switches: Switches;
  toggleTheme: () => void;
  setRate: (rate: number) => void;
  setAccent: (accent: Accent) => void;
  setExampleStyle: (style: ExampleStyle) => void;
  setDailyGoal: (goal: number) => void;
  setSwitch: (key: SwitchKey, value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      rate: 1,
      accent: 'us',
      exampleStyle: 'exam',
      dailyGoal: 20,
      switches: { ...DEFAULT_SWITCHES },
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
      setRate: (r) => set({ rate: Math.min(5, Math.max(0.1, Math.round(r * 100) / 100)) }),
      setAccent: (accent) => set({ accent }),
      setExampleStyle: (exampleStyle) => set({ exampleStyle }),
      setDailyGoal: (goal) =>
        set({ dailyGoal: Math.min(500, Math.max(1, Math.round(goal) || 20)) }),
      setSwitch: (key, value) =>
        set((s) => ({ switches: { ...s.switches, [key]: value } })),
    }),
    {
      name: 'wordwave-settings-v1',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          ...p,
          switches: { ...current.switches, ...(p.switches ?? {}) },
        };
      },
    },
  ),
);
