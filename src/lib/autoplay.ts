import { useAutoplayStore, type AutoplayConfig } from '../store/autoplay';
import { useSettingsStore } from '../store/settings';
import { useWordsStore } from '../store/words';
import { useProgressStore } from '../store/progress';
import { useToastStore } from '../store/toast';
import { getExample } from '../api/client';
import { pauseSpeech, resumeSpeech, speak, stopSpeech, type SpeakHint } from './speech';
import { splitSyllables } from './syllables';
import type { ExampleData, Word } from '../types';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rateNow = () => useSettingsStore.getState().rate;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildAutoplayQueue(words: Word[], cfg: AutoplayConfig): Word[] {
  const progress = useProgressStore.getState();
  let list: Word[];
  switch (cfg.order) {
    case 'unknown':
      list = words.filter((w) => !progress.records[w.word]?.learnedAt);
      break;
    case 'wrong':
      list = words.filter((w) => (progress.records[w.word]?.wrongCount ?? 0) > 0);
      break;
    case 'category':
      list = words.filter((w) => w.category === cfg.category);
      break;
    case 'range':
      list = words.filter((w) => w.id >= cfg.rangeMin && w.id <= cfg.rangeMax);
      break;
    default:
      list = words;
  }
  list = [...list];
  if (cfg.order === 'random') shuffle(list);
  const n = Math.max(0, Math.min(cfg.count, list.length));
  return list.slice(0, n);
}

class AutoplayEngine {
  private gen = 0;

  start(config: AutoplayConfig): void {
    const words = useWordsStore.getState().words;
    const queue = buildAutoplayQueue(words, config);
    if (queue.length === 0) {
      useToastStore.getState().show('当前筛选条件下没有可播放的单词', 'error');
      return;
    }
    this.stopInternal();
    this.gen++;
    const g = this.gen;
    useAutoplayStore.setState({
      config,
      status: 'playing',
      queue,
      index: 0,
      repeatIndex: 0,
      total: queue.length,
      done: 0,
      currentWord: queue[0],
      exampleData: null,
      exampleLoading: false,
      exampleFromCache: false,
      exampleError: null,
    });
    void this.run(g);
  }

  pause(): void {
    const st = useAutoplayStore.getState();
    if (st.status !== 'playing') return;
    pauseSpeech();
    useAutoplayStore.setState({ status: 'paused' });
  }

  resume(): void {
    const st = useAutoplayStore.getState();
    if (st.status !== 'paused') return;
    resumeSpeech();
    useAutoplayStore.setState({ status: 'playing' });
  }

  toggle(): void {
    const st = useAutoplayStore.getState();
    if (st.status === 'playing') this.pause();
    else if (st.status === 'paused') this.resume();
  }

  next(): void {
    this.jumpTo(useAutoplayStore.getState().index + 1);
  }

  prev(): void {
    this.jumpTo(useAutoplayStore.getState().index - 1);
  }

  jumpTo(index: number): void {
    const st = useAutoplayStore.getState();
    if (st.status === 'idle' || st.queue.length === 0) return;
    const clamped = Math.max(0, Math.min(st.queue.length - 1, index));
    this.gen++;
    const g = this.gen;
    stopSpeech();
    useAutoplayStore.setState({
      index: clamped,
      repeatIndex: 0,
      currentWord: st.queue[clamped] ?? null,
      exampleData: null,
      exampleLoading: false,
      exampleError: null,
      status: st.status === 'finished' ? 'playing' : st.status,
    });
    void this.run(g);
  }

  stop(): void {
    this.stopInternal();
  }

  private stopInternal(): void {
    this.gen++;
    stopSpeech();
    useAutoplayStore.setState({
      status: 'idle',
      queue: [],
      index: 0,
      repeatIndex: 0,
      total: 0,
      done: 0,
      currentWord: null,
      exampleData: null,
      exampleLoading: false,
      exampleError: null,
    });
  }

  private async run(g: number): Promise<void> {
    while (this.gen === g) {
      const st = useAutoplayStore.getState();
      if (st.status === 'idle' || st.status === 'finished') return;
      if (st.status === 'paused') {
        await sleep(150);
        continue;
      }
      const word = st.queue[st.index];
      if (!word) {
        useAutoplayStore.setState({ status: 'finished' });
        return;
      }
      useAutoplayStore.setState({ repeatIndex: 0 });
      try {
        await this.playWord(word);
      } catch (err) {
        if (this.gen !== g) return;
        useToastStore
          .getState()
          .show(
            `播放异常（${err instanceof Error ? err.message : String(err)}），已自动跳过`,
            'error',
          );
      }
      if (this.gen !== g) return;
      useProgressStore.getState().markSeen(word);
      const cur = useAutoplayStore.getState();
      const nextIndex = cur.index + 1;
      useAutoplayStore.setState({
        index: nextIndex,
        done: nextIndex,
        repeatIndex: 0,
        currentWord: cur.queue[nextIndex] ?? null,
      });
      if (nextIndex >= cur.queue.length) {
        useAutoplayStore.setState({ status: 'finished', currentWord: null });
        useToastStore.getState().show('自动播放完成 🎉', 'success');
        return;
      }
      await this.waitInterval(g);
    }
  }

  /** 等待暂停解除；若播放被停止/完成则返回 false */
  private async ensureActive(g: number): Promise<boolean> {
    while (this.gen === g) {
      const status = useAutoplayStore.getState().status;
      if (status === 'playing') return true;
      if (status === 'idle' || status === 'finished') return false;
      await sleep(120);
    }
    return false;
  }

  /**
   * 带看门狗的朗读：正常等发音结束；暂停时不计超时；
   * 播放中超过 25 秒仍无结束事件（语音引擎卡死）则强制跳过，保证自动播放永不卡住。
   */
  private async speakGuarded(text: string, lang: 'en' | 'zh', hint?: SpeakHint): Promise<void> {
    const g = this.gen;
    const started = Date.now();
    let done = false;
    const p = speak(text, lang, rateNow(), hint).then(() => {
      done = true;
    });
    while (!done) {
      if (this.gen !== g) {
        stopSpeech();
        return;
      }
      const status = useAutoplayStore.getState().status;
      if (status !== 'playing') {
        if (status === 'idle' || status === 'finished') {
          stopSpeech();
          return;
        }
        await sleep(150);
        continue;
      }
      if (Date.now() - started > 25000) {
        stopSpeech();
        return;
      }
      await sleep(200);
    }
    await p;
  }

  private async playWord(word: Word): Promise<void> {
    const settings = useSettingsStore.getState();
    const g = this.gen;
    const repeats = Math.max(1, useAutoplayStore.getState().config.repeats || 1);

    // 预取 AI 例句：单词一开始就并行请求，读完发音后直接可用，无需再等
    let examplePromise: Promise<{ data: ExampleData; fromCache: boolean }> | null = null;
    if (settings.switches.aiExamples) {
      const withTranslation = settings.switches.withTranslation;
      useAutoplayStore.setState({
        exampleLoading: true,
        exampleData: null,
        exampleError: null,
      });
      const p = getExample(
        word.word,
        word.meaning,
        withTranslation,
        useSettingsStore.getState().exampleStyle,
        false,
      );
      p.catch(() => {});
      examplePromise = p;
    }

    // 逐音节慢读：每个词只做一次，不算在“重复次数”里
    if (settings.switches.syllables) {
      const parts = splitSyllables(word.word);
      if (parts.length > 1) {
        for (const part of parts) {
          if (!(await this.ensureActive(g))) return;
          await this.speakGuarded(part, 'en', {
            wordId: word.id,
            wordText: word.word,
            kind: 'syllable',
          });
        }
      }
    }
    // 整词按用户设定的重复次数朗读
    for (let r = 0; r < repeats; r++) {
      if (!(await this.ensureActive(g))) return;
      useAutoplayStore.setState({ repeatIndex: r });
      await this.speakGuarded(word.word, 'en', {
        wordId: word.id,
        wordText: word.word,
        kind: 'word',
      });
    }

    if (!(await this.ensureActive(g))) return;

    // 中文释义每词只读一遍
    if (settings.switches.readMeaning) {
      await this.speakGuarded(word.meaning, 'zh', {
        wordId: word.id,
        wordText: word.word,
        kind: 'meaning',
      });
      if (!(await this.ensureActive(g))) return;
    }

    // AI 例句：等待预取结果并朗读
    if (examplePromise) {
      const withTranslation = settings.switches.withTranslation;
      let data: ExampleData;
      try {
        const res = await examplePromise;
        if (!(await this.ensureActive(g))) return;
        data = res.data;
        useAutoplayStore.setState({
          exampleLoading: false,
          exampleData: data,
          exampleFromCache: res.fromCache,
          exampleError: null,
        });
      } catch (err) {
        if (this.gen !== g) return;
        useAutoplayStore.setState({
          exampleLoading: false,
          exampleData: null,
          exampleError: err instanceof Error ? err.message : String(err),
        });
        useToastStore.getState().show('AI 例句生成失败，已自动跳过（不影响播放）', 'error');
        return;
      }

      if (!(await this.ensureActive(g))) return;
      await this.speakGuarded(data.english, 'en', { kind: 'example' });
      if (withTranslation && data.chinese) {
        if (!(await this.ensureActive(g))) return;
        await this.speakGuarded(data.chinese, 'zh', { kind: 'example' });
      }
    }
  }

  private async waitInterval(g: number): Promise<void> {
    const ms = Math.max(0, (useAutoplayStore.getState().config.interval || 0) * 1000);
    const start = Date.now();
    let pausedMs = 0;
    while (this.gen === g) {
      const status = useAutoplayStore.getState().status;
      if (status !== 'playing') {
        if (status === 'idle' || status === 'finished') return;
        const pStart = Date.now();
        await sleep(150);
        pausedMs += Date.now() - pStart;
        continue;
      }
      if (Date.now() - start - pausedMs >= ms) return;
      await sleep(150);
    }
  }
}

export const autoplayEngine = new AutoplayEngine();
