/**
 * Drives the Home layout tool against the real, assembled published site and fails if a
 * first-time visitor's edit does not reach the framed app.
 *
 *     node apps/workbench/scripts/home-live.mjs
 *
 * **What `renders.mjs` cannot see.** Its three assertions are "did the shell mount", read
 * against `apps/workbench/dist` alone — it never serves `apps/mobile/dist` underneath it,
 * so it has never once loaded the app frame `/preview` exists to show. A published-site bug
 * that reproduces only *inside that frame* is therefore invisible to it by construction, and
 * this is exactly that class of bug: `/preview` with the home tool open, on the plain link
 * `RELEASE.md` hands out — no `s=` fixture, a first visit — opened on the sign-in door.
 * Every edit in the Home layout tool reached `localStorage` and the door never moved, which
 * read as "moving a block does not redraw the app" and was reported as one. Fixed in
 * `preview/Preview.tsx` and `preview/frame/seed.ts`; this is the check that would have
 * caught it, because it is the first thing in this repository that opens `/preview`, reads
 * *inside* the app frame, and drives a tool the way a person would rather than reading source.
 *
 * **The assembly matters as much as the assertion.** `apps/mobile/dist` has to be built with
 * `EXPO_BASE_URL=/app`, the same way `pages.yml` builds it, or the assembled site tests a
 * shape nobody deploys — every asset would 404 under `/app/` and the frame would be a 404 in
 * a phone-shaped box, which is a different, older, already-guarded failure
 * (TROUBLESHOOTING.md, "A default export writes URLs absolute from the domain root"). So this
 * refuses to run rather than silently pass on the wrong export; see `assertBuilt` below.
 *
 *     cd apps/workbench && npm run build
 *     cd apps/mobile && EXPO_BASE_URL=/app npm run build:web
 *     node apps/workbench/scripts/home-live.mjs
 *
 * No dependency beyond Node and a browser, matching `renders.mjs`: the Chrome DevTools
 * Protocol is JSON over a `WebSocket`, and everything this needs inside the app frame is a
 * same-origin property read `Runtime.evaluate` can do from the shell's own document — no
 * second CDP target, because the shell already reaches the frame that way itself
 * (ADR 0014).
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { connect, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKBENCH = dirname(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = join(WORKBENCH, '../..');
const WORKBENCH_DIST = join(WORKBENCH, 'dist');
const MOBILE_DIST = join(ROOT, 'apps/mobile/dist');

/** Where the page is judged to have settled, and how long it is given to. */
const READY_MS = 60_000;
const POLL_MS = 250;

/** How long a server started here gets to accept a connection. */
const LISTEN_MS = 10_000;

/** Same list `renders.mjs` tries, in the same order, for the same reason. */
const BROWSERS = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
  'chrome',
];

/** A failure this script has already explained. */
class Reported extends Error {}

/** Everything started here, in the order to undo it. */
const started = [];
async function unwind() {
  while (started.length > 0) {
    try {
      await started.pop()();
    } catch {
      // Best-effort: a process that already exited must not turn a green run red.
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A free port, asked of the operating system rather than guessed. */
async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Whether anything is listening there yet. */
function accepts(port) {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

/**
 * Refuses to test a build that was not assembled, or that was assembled wrong.
 *
 * Two different faults, and one message each: a missing build says which command
 * produces it; a build with the wrong base path says why the base matters, because
 * "it built" and "it built the thing this test needs" are not the same fact, and the
 * gap between them is invisible until the assembled site is live (TROUBLESHOOTING.md,
 * "A default export writes URLs absolute from the domain root").
 */
function assertBuilt() {
  if (!existsSync(join(WORKBENCH_DIST, 'index.html'))) {
    throw new Reported(
      'apps/workbench/dist/index.html is missing — run `npm run build:workbench` first.',
    );
  }
  if (!existsSync(join(MOBILE_DIST, 'index.html'))) {
    throw new Reported(
      'apps/mobile/dist/index.html is missing — build it with the Pages base:\n' +
        '  cd apps/mobile && EXPO_BASE_URL=/app npm run build:web',
    );
  }
  const html = readFileSync(join(MOBILE_DIST, 'index.html'), 'utf8');
  if (!html.includes('"/app/_expo/static/js/web/')) {
    throw new Reported(
      'apps/mobile/dist/index.html does not reference /app/_expo/ — it was exported without ' +
        'EXPO_BASE_URL=/app, so assembling it under the workbench would test a site nobody can ' +
        'reach. Rebuild with:\n  cd apps/mobile && EXPO_BASE_URL=/app npm run build:web',
    );
  }
}

/**
 * The workbench and the app, assembled the way `pages.yml` assembles them, served the
 * way GitHub Pages serves them.
 *
 * A fresh temporary directory rather than `apps/workbench/dist` in place, so this never
 * writes into either package's own build output and two runs cannot collide.
 */
async function assembledServer() {
  assertBuilt();
  const site = mkdtempSync(join(tmpdir(), 'workbench-home-live-'));
  started.push(() => rmSync(site, { recursive: true, force: true }));
  cpSync(WORKBENCH_DIST, site, { recursive: true });
  cpSync(MOBILE_DIST, join(site, 'app'), { recursive: true });

  const port = await freePort();
  const child = spawn('node', [join(ROOT, 'screens/tools/serve-clean.mjs'), site, String(port)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  started.push(() => child.kill('SIGKILL'));
  let said = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => (said += chunk));

  const deadline = Date.now() + LISTEN_MS;
  while (!(await accepts(port))) {
    if (child.exitCode !== null) {
      throw new Reported(
        `serve-clean.mjs exited with ${child.exitCode} before it listened.\n${said}`,
      );
    }
    if (Date.now() > deadline) {
      throw new Reported(
        `serve-clean.mjs did not listen on ${port} within ${LISTEN_MS / 1000}s.\n${said}`,
      );
    }
    await sleep(25);
  }
  return { url: `http://localhost:${port}/` };
}

/** Headless Chrome, and a socket to drive it over. Copied from `renders.mjs` verbatim. */
async function browser() {
  const profile = mkdtempSync(join(tmpdir(), 'workbench-home-live-chrome-'));
  started.push(() => rmSync(profile, { recursive: true, force: true }));
  const candidates = [process.env.CHROME_PATH, ...BROWSERS].filter(Boolean);
  let child;
  let endpoint;
  for (const binary of candidates) {
    child = spawn(
      binary,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    endpoint = await new Promise((resolve) => {
      let stderr = '';
      const done = (value) => resolve(value);
      child.once('error', () => done(undefined));
      child.once('exit', () => done(undefined));
      const timer = setTimeout(() => done(undefined), 20_000);
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
        const found = stderr.match(/ws:\/\/\S+/);
        if (found) {
          clearTimeout(timer);
          done(found[0]);
        }
      });
    });
    if (endpoint) break;
    child.kill('SIGKILL');
  }
  if (!endpoint) {
    throw new Reported(
      `No browser to look with. Tried ${candidates.join(', ')}.\n` +
        `Install Chrome or Chromium, or point CHROME_PATH at one.`,
    );
  }
  started.push(() => child.kill('SIGKILL'));
  return endpoint;
}

/** The handful of CDP calls this needs, over the socket Chrome printed. */
async function attach(endpoint) {
  const socket = new WebSocket(endpoint);
  started.push(() => socket.close());
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let last = 0;
  const waiting = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      waiting.get(message.id)(message.result ?? {});
      waiting.delete(message.id);
    }
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const id = ++last;
      waiting.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return { call };
}

/**
 * One expression, evaluated in the shell's own document.
 *
 * Every question this script asks — has the shell mounted, is the door showing inside the
 * frame, did the frame's text change — is a same-origin read from there: `document`,
 * `document.querySelector('iframe').contentWindow` and `contentDocument`. No second CDP
 * target is attached for the frame, because the shell itself never needs one either
 * (ADR 0014): everything in `preview/frame/` reaches the app by property access from the
 * page that already has it.
 */
async function evaluate(call, sessionId, expression) {
  const { result, exceptionDetails } = await call(
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  );
  if (exceptionDetails) {
    throw new Reported(`the page threw evaluating a check:\n${exceptionDetails.text}`);
  }
  return result?.value;
}

/** What the frame currently shows, or null while there is nothing to read yet. */
const READ_FRAME = `(() => {
  const frame = document.querySelector('iframe');
  const win = frame && frame.contentWindow;
  try {
    if (!win || win.document.readyState !== 'complete') return null;
    const text = win.document.body ? win.document.body.innerText : '';
    return text.trim().length > 0 ? text : null;
  } catch {
    return null;
  }
})()`;

async function main() {
  const server = await assembledServer();
  const endpoint = await browser();
  const { call } = await attach(endpoint);

  const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
  await call('Runtime.enable', {}, sessionId);
  await call('Page.enable', {}, sessionId);

  // A desktop viewport, or `Preview.tsx`'s own `defaultFull()` reads the headless
  // window's default narrow size as a small screen and goes full-bleed on arrival —
  // hiding the tool rail and the home layout panel entirely, which is a different,
  // page-chrome-driven way to end up with no "Move … down" button to click.
  await call(
    'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );

  // The exact reproduction: the plain link `RELEASE.md` hands out, `?s=` unset, the home
  // tool open. Nothing seeds a fixture — a first-time visitor has nothing else to give it.
  await call('Page.navigate', { url: `${server.url}preview#/?tool=home` }, sessionId);

  const deadline = Date.now() + READY_MS;
  let before = null;
  while (Date.now() < deadline) {
    const mounted = await evaluate(
      call,
      sessionId,
      "(document.getElementById('root')?.childElementCount ?? 0) > 0",
    );
    if (mounted) before = await evaluate(call, sessionId, READ_FRAME);
    if (before) break;
    await sleep(POLL_MS);
  }
  if (!before) {
    throw new Reported(
      `the app frame never rendered anything within ${READY_MS / 1000}s. ` +
        `Either the shell did not mount /preview, or the frame never loaded /app/.`,
    );
  }

  // The tell for the sign-in door: a stable, always-present label on that form and
  // nowhere on Home. Failing here, specifically, is the original defect: a first visit
  // opened on the door and the home tool had nothing behind it to redraw.
  if (before.includes('Passwort')) {
    throw new Reported(
      `a first-time visit to /preview#/?tool=home opened the app frame on the sign-in ` +
        `door instead of Home. The home tool's edits reach storage and have nothing to ` +
        `redraw, which reads as "moving a block does not redraw the app". Fixed by ` +
        `holding the door open (and completing onboarding) in Preview.tsx when no ` +
        `fixture is named; this assertion is what regressed if it fires again.\n` +
        `Frame text: ${before.slice(0, 200)}`,
    );
  }

  // Move the first section down, the same click a person makes. Same-origin property
  // access from the shell's own document, not a second CDP target — this is a DOM click
  // on the shell's page, same as every control the Home layout tool draws. Polled: the
  // panel is its own async mount, separate from the frame settling above.
  const CLICK_MOVE_DOWN = `(() => {
    const btn = Array.from(document.querySelectorAll('button'))
      .find((b) => b.getAttribute('aria-label')?.startsWith('Move ') && b.getAttribute('aria-label')?.endsWith(' down') && !b.disabled);
    if (!btn) return false;
    btn.click();
    return true;
  })()`;
  let moved = false;
  const panelDeadline = Date.now() + READY_MS;
  while (Date.now() < panelDeadline) {
    moved = await evaluate(call, sessionId, CLICK_MOVE_DOWN);
    if (moved) break;
    await sleep(POLL_MS);
  }
  if (!moved) {
    throw new Reported(
      `no enabled "Move … down" button appeared within ${READY_MS / 1000}s — the home tool ` +
        `did not render its rows.`,
    );
  }

  let after = before;
  const movedDeadline = Date.now() + READY_MS;
  while (Date.now() < movedDeadline) {
    await sleep(POLL_MS);
    after = await evaluate(call, sessionId, READ_FRAME);
    if (after && after !== before) break;
  }

  if (after === before) {
    throw new Reported(
      `moving a block in the home tool did not redraw the app frame within ` +
        `${READY_MS / 1000}s. The stored document changed (write.ts still writes it) and ` +
        `the frame's own \`storage\` listener (layout.ts) did not pick it up, or the ` +
        `frame was not showing a screen the edit could reach.`,
    );
  }

  console.log('home-live: a fresh visit reaches Home, and moving a block redraws the frame.');
}

let status = 0;
try {
  await main();
} catch (error) {
  console.error(error instanceof Reported ? error.message : error);
  status = 1;
} finally {
  await unwind();
}
process.exit(status);
