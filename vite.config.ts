import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** onnxruntime 会以 `?import` 动态加载 wasm 胶水，Vite 转换管线会 500，这里原样返回 */
function serveRawWasm() {
  return {
    name: 'serve-raw-wasm',
    configureServer(server: {
      middlewares: {
        use: (path: string, handler: (req: unknown, res: unknown, next: () => void) => void) => void;
      };
    }) {
      server.middlewares.use('/wasm', (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void }, next: () => void) => {
        const urlPath = (req.url ?? '').split('?')[0];
        const base = path.join(ROOT, 'public', 'wasm');
        const rel = urlPath.replace(/^\/wasm\//, '');
        const file = path.join(base, rel);
        const safe = path.relative(base, file);
        if (safe.startsWith('..') || path.isAbsolute(safe) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          return next();
        }
        const ext = path.extname(file);
        const type =
          ext === '.wasm'
            ? 'application/wasm'
            : ext === '.data'
              ? 'application/octet-stream'
              : 'application/javascript';
        res.setHeader('Content-Type', type);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(fs.readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveRawWasm()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8010',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
