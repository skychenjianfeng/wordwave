import puppeteer from 'file:///C:/Users/Intel/AppData/Local/Temp/ww-verify/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import os from 'node:os';
import path from 'node:path';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  protocolTimeout: 180000,
  userDataDir: path.join(os.tmpdir(), `ww-e2e-debug-${Date.now()}`),
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--mute-audio'],
});

try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.text().includes('offline-tts') || m.type() === 'error') {
      console.log('[console]', m.type(), m.text().slice(0, 200));
    }
  });
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/models/') || u.includes('/wasm/')) console.log('[req]', u.slice(0, 120));
  });
  const BASE = process.env.WW_BASE || 'http://localhost:5173';
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('5530'), { timeout: 30000 });

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.includes('自动播放'))?.click();
  });
  await page.waitForFunction(() => document.body.innerText.includes('开关区'));
  const clickSwitch = (key) =>
    page.evaluate((k) => {
      document.querySelector(`[data-switch="${k}"]`)?.querySelector('button[role="switch"]')?.click();
    }, key);
  await clickSwitch('aiExamples');
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const div = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent.includes('本次播放数量'),
    );
    const input = div?.querySelector('input[type="number"]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, '1');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent.includes('开始自动播放'),
    );
    btn?.click();
  });

  const ready = await page
    .waitForFunction(() => window.__wwOfflineTtsReady === true, { timeout: 150000 })
    .then(() => true)
    .catch(() => false);
  console.log('READY', ready);
  const res = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((n) => n.includes('models') || n.includes('wasm') || n.includes('onnx')),
  );
  console.log('RESOURCES', JSON.stringify(res, null, 1));
} finally {
  await browser.close();
}
