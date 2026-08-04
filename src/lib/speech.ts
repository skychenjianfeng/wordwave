import { splitSyllables } from './syllables';
import { useSettingsStore } from '../store/settings';
import { useToastStore } from '../store/toast';
import { useWordsStore } from '../store/words';
import { isOfflineTtsReady, offlineTtsSupported, offlineTtsUrl } from './offlineTts';
import type { Word } from '../types';

const clampRate = (r: number) => Math.min(5, Math.max(0.1, r));

let enUsVoice: SpeechSynthesisVoice | null = null;
let enUkVoice: SpeechSynthesisVoice | null = null;
let zhVoice: SpeechSynthesisVoice | null = null;
let initialized = false;
let currentAudio: HTMLAudioElement | null = null;
const audioUrlCache = new Map<string, string>();
let voicesMissingShown = false;
let offlineLoadingShown = false;
let resumeFailResolve: (() => void) | null = null;
let kaoyanIdPromise: Promise<Map<string, number>> | null = null;
let syllableMapPromise: Promise<Map<string, string>> | null = null;

export interface SpeakHint {
  wordId?: number;
  wordText?: string;
  kind?: 'word' | 'syllable' | 'meaning' | 'example';
}

function pickVoices(): void {
  if (!speechSupported()) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  // 优先本地微软音色（离线可用）；避免选到 Google 在线音色（国内网络下会静音）
  enUsVoice =
    voices.find(
      (v) => /en[-_]US/i.test(v.lang) && /microsoft/i.test(v.name) && !/online/i.test(v.name),
    ) ??
    voices.find(
      (v) => /en[-_]US/i.test(v.lang) && !/google/i.test(v.name) && !/online/i.test(v.name),
    ) ??
    voices.find((v) => /en[-_]US/i.test(v.lang)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    null;
  enUkVoice =
    voices.find(
      (v) => /en[-_]GB/i.test(v.lang) && /microsoft/i.test(v.name) && !/online/i.test(v.name),
    ) ??
    voices.find((v) => /en[-_]GB/i.test(v.lang) && !/google/i.test(v.name) && !/online/i.test(v.name)) ??
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ??
    null;
  zhVoice =
    voices.find((v) => /zh[-_]CN/i.test(v.lang) && !/online/i.test(v.name)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('zh')) ??
    null;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function initSpeech(): void {
  if (initialized || !speechSupported()) return;
  initialized = true;
  pickVoices();
  window.speechSynthesis.onvoiceschanged = pickVoices;
}

function speakSynth(text: string, lang: 'en' | 'zh', rate: number): Promise<void> {
  return new Promise((resolve) => {
    if (!speechSupported() || !text.trim()) {
      resolve();
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
      u.rate = clampRate(rate);
      if (lang === 'zh' && zhVoice) u.voice = zhVoice;
      if (lang === 'en') {
        const accent = useSettingsStore.getState().accent;
        const enVoice = accent === 'uk' ? (enUkVoice ?? enUsVoice) : (enUsVoice ?? enUkVoice);
        if (enVoice) u.voice = enVoice;
      }
      if (!voicesMissingShown && window.speechSynthesis.getVoices().length === 0) {
        voicesMissingShown = true;
        useToastStore.getState().show('未检测到系统语音，将使用本地 Piper 发音', 'info');
      }
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

/** 本地服务端发音：请求 Django 内置 Piper 开源神经语音（离线），返回 Blob URL */
async function fetchSpeechAudio(text: string, lang: 'en' | 'zh'): Promise<string | null> {
  const accent = useSettingsStore.getState().accent;
  const key = `${lang}:${accent}:${text}`;
  const cached = audioUrlCache.get(key);
  if (cached) return cached;
  const controller = new AbortController();
  // 本地 Piper 首次调用需加载模型（数秒），给足超时；此后服务端磁盘缓存秒回
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(
      `/api/speech?text=${encodeURIComponent(text)}&lang=${lang}&accent=${accent}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (audioUrlCache.size >= 300) {
      const oldest = audioUrlCache.keys().next().value;
      if (oldest !== undefined) {
        const oldUrl = audioUrlCache.get(oldest);
        audioUrlCache.delete(oldest);
        if (oldUrl) URL.revokeObjectURL(oldUrl);
      }
    }
    audioUrlCache.set(key, url);
    return url;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 长文本按句子/标点切段，规避浏览器语音对超长句子的静音/截断问题 */
function splitText(text: string, maxLen = 140): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];
  const parts = trimmed.split(/(?<=[.!?;:，。！？；：])\s+/);
  const chunks: string[] = [];
  let cur = '';
  for (const part of parts) {
    if ((cur + ' ' + part).trim().length > maxLen) {
      if (cur) chunks.push(cur.trim());
      cur = part;
      while (cur.length > maxLen) {
        let cut = cur.lastIndexOf(' ', maxLen);
        if (cut <= 0) cut = maxLen;
        chunks.push(cur.slice(0, cut).trim());
        cur = cur.slice(cut).trim();
      }
    } else {
      cur = (cur + ' ' + part).trim();
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

/**
 * 考研 5530 词库的音包按「词内序号」命名（/audio/words/<id>.mp3），
 * 其他词库的 word.id 从 1 重新计数，不能直接用来定位音包。
 * 这里统一用「单词文本 -> 考研序号」映射解析音包，音包外的词交给 TTS 回退。
 */
function getKaoyanIdMap(): Promise<Map<string, number>> {
  if (!kaoyanIdPromise) {
    kaoyanIdPromise = fetch('/data/dicts/kaoyan.json')
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((list: Word[]) => {
        const map = new Map<string, number>();
        for (const w of list) {
          const k = String(w.word ?? '').trim().toLowerCase();
          if (k && !map.has(k)) map.set(k, Number(w.id));
        }
        return map;
      })
      .catch(() => new Map<string, number>());
  }
  return kaoyanIdPromise;
}

function getSyllableMap(): Promise<Map<string, string>> {
  if (!syllableMapPromise) {
    syllableMapPromise = fetch('/audio/syllables.json')
      .then((r) => (r.ok ? r.json() : Promise.resolve({})))
      .then((obj: unknown) => {
        const map = new Map<string, string>();
        if (obj && typeof obj === 'object') {
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            if (typeof v === 'string') map.set(k, v);
          }
        }
        return map;
      })
      .catch(() => new Map<string, string>());
  }
  return syllableMapPromise;
}

/** 解析本地预生成发音文件候选列表（英式优先，回退美式）；空数组交给上层回退 */
async function resolveLocalUrls(
  text: string,
  lang: 'en' | 'zh',
  hint?: SpeakHint,
): Promise<string[]> {
  if (hint?.kind === 'example') return [];
  const clean = text.trim().toLowerCase();
  const accent = useSettingsStore.getState().accent;
  const urls: string[] = [];
  const push = (u: string) => {
    if (u && !urls.includes(u)) urls.push(u);
  };
  if (lang === 'en') {
    if (hint?.kind === 'syllable') {
      const map = await getSyllableMap();
      const file = map.get(clean);
      if (file) {
        if (accent === 'uk') push(`/audio/uk/syllables/${file}.mp3`);
        push(`/audio/syllables/${file}.mp3`);
      }
      return urls;
    }
    if (!hint || hint.kind === 'word') {
      const kaoyanId = (await getKaoyanIdMap()).get(clean);
      if (kaoyanId != null) {
        if (accent === 'uk') push(`/audio/uk/words/${kaoyanId}.mp3`);
        push(`/audio/words/${kaoyanId}.mp3`);
      }
    }
    return urls;
  }
  if (lang === 'zh' && hint?.kind === 'meaning') {
    const isKaoyan = useWordsStore.getState().activeDictId === 'kaoyan';
    let kaoyanId = isKaoyan ? hint.wordId : null;
    if (kaoyanId == null && hint.wordText) {
      kaoyanId = (await getKaoyanIdMap()).get(hint.wordText.trim().toLowerCase());
    }
    if (kaoyanId != null) push(`/audio/meanings/${kaoyanId}.mp3`);
  }
  return urls;
}

/** 播放音频 URL（本地 MP3 或离线 TTS 生成的 WAV），统一应用全局语速；失败返回 false */
function playAudioUrl(url: string, rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    let audio: HTMLAudioElement | null = null;
    let timer = 0;
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      resumeFailResolve = null;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        if (currentAudio === audio) currentAudio = null;
      }
    };
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ok);
    };
    try {
      const el = new Audio(url);
      audio = el;
      currentAudio = el;
      resumeFailResolve = () => finish(false);
      el.preload = 'auto';
      el.playbackRate = clampRate(rate);
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      timer = window.setTimeout(() => finish(false), 8000);
      el.load();
      el.muted = true;
      el
        .play()
        .then(() => {
          el.muted = false;
        })
        .catch(() => finish(false));
    } catch {
      finish(false);
    }
  });
}

/** 本地服务端发音：Django 内置 Piper 开源神经语音（离线），失败返回 false */
function playServerPiper(text: string, lang: 'en' | 'zh', rate: number): Promise<boolean> {
  return new Promise((resolve) => {
    void (async () => {
      const url = await fetchSpeechAudio(text, lang);
      if (!url) {
        resolve(false);
        return;
      }
      resolve(await playAudioUrl(url, rate));
    })();
  });
}

/** 朗读文本：本地音包 → Django 内置 Piper → 浏览器 Piper WASM → 系统语音，全程离线 */
export async function speak(
  text: string,
  lang: 'en' | 'zh',
  rate: number,
  hint?: SpeakHint,
): Promise<void> {
  if (!text.trim()) return;
  const chunks =
    hint?.kind === 'example' || text.trim().length > 140 ? splitText(text) : [text.trim()];
  for (const chunk of chunks) {
    if (!chunk) continue;
    const localUrls = await resolveLocalUrls(chunk, lang, hint);
    let playedLocal = false;
    for (const localUrl of localUrls) {
      const ok = await playAudioUrl(localUrl, rate);
      if (ok) {
        playedLocal = true;
        break;
      }
    }
    if (playedLocal) {
      continue;
    }
    // Django 内置 Piper（本地开源引擎，支持美式/英式，不访问外网）
    if (lang === 'en') {
      const serverOk = await playServerPiper(chunk, lang, rate);
      if (serverOk) {
        continue;
      }
    }
    // 浏览器端 Piper WASM 兜底：英文动态文本（如 AI 例句）完全离线合成。
    // Piper 目前只有美音模型，英式口音下改走系统语音（优先 en-GB 本地音色）
    if (lang === 'en' && offlineTtsSupported() && useSettingsStore.getState().accent === 'us') {
      if (!isOfflineTtsReady() && !offlineLoadingShown) {
        offlineLoadingShown = true;
        useToastStore.getState().show('正在加载本地语音引擎（首次约需数秒）…', 'info');
      }
      const url = await offlineTtsUrl(chunk);
      if (url) {
        const ok = await playAudioUrl(url, rate);
        if (ok) continue;
      }
    }
    await speakSynth(chunk, lang, rate);
  }
}

/** 逐音节慢读 + 整词朗读（语速跟随全局设置） */
export async function speakWordSmart(word: Word, rate: number, withSyllables: boolean): Promise<void> {
  if (withSyllables) {
    const parts = splitSyllables(word.word);
    if (parts.length > 1) {
      for (const p of parts) {
        await speak(p, 'en', rate, { wordId: word.id, wordText: word.word, kind: 'syllable' });
      }
    }
  }
  await speak(word.word, 'en', rate, { wordId: word.id, wordText: word.word, kind: 'word' });
}

export async function speakSyllablesOnly(word: Word, rate: number): Promise<void> {
  for (const p of splitSyllables(word.word)) {
    await speak(p, 'en', rate, { wordId: word.id, wordText: word.word, kind: 'syllable' });
  }
}

export function pauseSpeech(): void {
  if (currentAudio && !currentAudio.paused) currentAudio.pause();
  if (speechSupported() && window.speechSynthesis.speaking) window.speechSynthesis.pause();
}

export function resumeSpeech(): void {
  if (currentAudio && currentAudio.paused) {
    void currentAudio.play().catch(() => {
      resumeFailResolve?.();
      resumeFailResolve = null;
    });
  }
  if (speechSupported()) window.speechSynthesis.resume();
}

export function stopSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return (
    (currentAudio !== null && !currentAudio.paused) ||
    (speechSupported() && window.speechSynthesis.speaking)
  );
}
