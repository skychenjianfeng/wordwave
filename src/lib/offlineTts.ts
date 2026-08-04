import { TtsSession } from '@realtimex/piper-tts-web';

// 本地神经 TTS（Piper en_US-lessac-medium，完全离线）：
// 模型与 WASM 引擎都打包在 public/ 下，首次使用把模型写入 OPFS，
// piper-tts-web 会优先读 OPFS 缓存，全程零联网。
const VOICE_ID = 'en_US-lessac-medium';
const MODEL_ONNX = '/models/en_US-lessac-medium.onnx';
const MODEL_JSON = '/models/en_US-lessac-medium.onnx.json';

const WASM_PATHS = {
  onnxWasm: '/wasm/onnx/',
  piperData: '/wasm/piper/piper_phonemize.data',
  piperWasm: '/wasm/piper/piper_phonemize.wasm',
};

let session: TtsSession | null = null;
let sessionPromise: Promise<TtsSession | null> | null = null;
const urlCache = new Map<string, string>();

function opfsKey(url: string): string {
  return url.split('/').pop() ?? '';
}

/** 把本地模型文件写入 OPFS（piper-tts-web 的缓存目录），已存在则跳过 */
async function seedOpfs(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await root.getDirectoryHandle('piper', { create: true });
    const seed = async (localUrl: string) => {
      const key = opfsKey(localUrl);
      try {
        await dir.getFileHandle(key);
        return; // 已有缓存
      } catch {
        // 不存在，继续写入
      }
      const res = await fetch(localUrl);
      if (!res.ok) throw new Error(`模型加载失败 ${localUrl}`);
      const blob = await res.blob();
      const file = await dir.getFileHandle(key, { create: true });
      const writable = await file.createWritable();
      await writable.write(blob);
      await writable.close();
    };
    await seed(MODEL_JSON);
    await seed(MODEL_ONNX);
  } catch (e) {
    console.warn('[offline-tts] OPFS 预置失败，将回退系统语音:', e);
  }
}

export function isOfflineTtsReady(): boolean {
  return session !== null;
}

export function offlineTtsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'storage' in navigator &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

export function getOfflineTtsSession(): Promise<TtsSession | null> {
  if (session) return Promise.resolve(session);
  if (!sessionPromise) {
    sessionPromise = (async () => {
      try {
        await seedOpfs();
        const s = await TtsSession.create({
          voiceId: VOICE_ID,
          wasmPaths: WASM_PATHS,
          allowLocalModels: true,
          fallbackStrategy: 'local',
          logger: (m) => console.log('[offline-tts]', m),
        });
        session = s;
        (window as unknown as Record<string, unknown>).__wwOfflineTtsReady = true;
        return s;
      } catch (e) {
        console.warn('[offline-tts] 初始化失败，将回退系统语音:', e);
        return null;
      }
    })();
  }
  return sessionPromise;
}

/** 合成一段英文文本，返回可播放的 WAV blob URL（带会话内缓存） */
export async function offlineTtsUrl(text: string): Promise<string | null> {
  const key = text.trim();
  if (!key) return null;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const s = await getOfflineTtsSession();
  if (!s) return null;
  const blob = await s.predict(key);
  const url = URL.createObjectURL(blob);
  if (urlCache.size >= 100) {
    const oldest = urlCache.keys().next().value;
    if (oldest !== undefined) {
      const oldUrl = urlCache.get(oldest);
      urlCache.delete(oldest);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
    }
  }
  urlCache.set(key, url);
  return url;
}
