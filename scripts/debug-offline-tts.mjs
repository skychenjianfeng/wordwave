import puppeteer from 'file:///C:/Users/Intel/AppData/Local/Temp/ww-verify/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import os from 'node:os';
import path from 'node:path';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  protocolTimeout: 180000,
  userDataDir: path.join(os.tmpdir(), `ww-debug-${Date.now()}`),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio'],
});

try {
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300)));
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  page.on('requestfailed', (r) =>
    console.log('[reqfail]', r.url().slice(0, 120), r.failure()?.errorText),
  );
  page.on('request', (r) => {
    if (r.url().includes('/models/') || r.url().includes('/wasm/')) {
      console.log('[req]', r.url().slice(0, 140));
    }
  });
  const BASE = process.env.WW_BASE || 'http://localhost:5173';
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  const info = await page.evaluate(async () => {
    const out = {};
    out.opfs = typeof navigator.storage?.getDirectory === 'function';
    out.coi = crossOriginIsolated;
    out.secure = window.isSecureContext;
    try {
      const mod = await import('/src/lib/offlineTts.ts');
      out.imported = true;
      const url = await mod.offlineTtsUrl('The local engine test sentence is working.');
      out.url = url ? url.slice(0, 40) : null;
      out.ready = mod.isOfflineTtsReady();
    } catch (e) {
      out.error = String(e).slice(0, 400);
    }
    return out;
  });
  console.log('RESULT', JSON.stringify(info, null, 2));
} finally {
  await browser.close();
}
