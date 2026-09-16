// Drives headless Chrome over CDP to *look at* the rendered page instead of inferring it
// from HTML. Node 24 has fetch + WebSocket built in, so this needs no dependencies.
//
//   node scripts/drive.mjs <url> <outPng> [waitMs]
//
// Exists because a class-name grep cannot tell you a control is invisible: a button once
// shipped at 1.00:1 contrast (same colour as its background) while every grep said "fine".
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2] ?? 'http://localhost:3400';
const outPng = process.argv[3] ?? join(tmpdir(), 'shot.png');
const waitMs = Number(process.argv[4] ?? 2500);

const userDataDir = mkdtempSync(join(tmpdir(), 'levi-chrome-'));
const port = 9333;

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1280,900',
    url,
  ],
  { stdio: ['ignore', 'ignore', 'ignore'] },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pageTarget() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* chrome not listening yet */
    }
    await sleep(250);
  }
  throw new Error('chrome did not expose a page target');
}

const target = await pageTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

await new Promise((r) => ws.addEventListener('open', r));

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');
await sleep(waitMs);

// What the page actually renders — text, not markup.
const evaluated = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    title: document.title,
    text: document.body.innerText.slice(0, 600),
    scripts: [...document.querySelectorAll('script[src]')].map(s => s.src),
    links: [...document.querySelectorAll('nav a')].map(a => a.getAttribute('href')),
    embedded: window.parent !== window,
    bg: getComputedStyle(document.body).backgroundColor,
    fg: getComputedStyle(document.body).color,
  })`,
  returnByValue: true,
});

console.log('--- RENDERED ---');
console.log(JSON.stringify(JSON.parse(evaluated.result.value), null, 2));

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
console.log('screenshot:', outPng);

ws.close();
chrome.kill();
process.exit(0);
