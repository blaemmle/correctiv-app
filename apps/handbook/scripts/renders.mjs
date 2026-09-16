/**
 * Opens the handbook in a browser and fails if `#root` is still empty.
 *
 *     node apps/handbook/scripts/renders.mjs dev    # the Vite dev server, started here
 *     node apps/handbook/scripts/renders.mjs dist   # apps/handbook/dist, served statically
 *
 * **Why a browser, when six source-reading tests are cheaper.** ADR 0031's four
 * mechanisms are about a thing somebody forgot to do, and nobody forgot anything
 * here: the work was done, it was correct, and it did not run. No type, no generator
 * and no reading of a file can see that, which is the argument ADR 0035 makes at
 * length. Issue #160 is the case. `apps/mobile/src/i18n/polyfills.ts` calls `require()` inside a
 * runtime condition; the production build hoisted that to a namespace import and
 * warned, and the dev server hoisted it to a DEFAULT import of a module that exports
 * nothing, which is a link-time `SyntaxError` and takes the whole graph down before
 * a line of it runs. Same source, same config, two answers. Typecheck, oxlint, oxfmt
 * and 400 tests were green throughout, `npm run build:handbook` was green, CI was
 * green, and `npm run handbook` — the one a person uses to look at their work — had
 * served an empty page for long enough that two agents built themselves ways around
 * it instead of reporting it.
 *
 * **Both paths, because the difference between them is where this lives.** The
 * production build is the one CI had; the dev server is the one nobody had. A check
 * that covered only the second would be the same mistake mirrored.
 *
 * **What it cannot see.** That the page is *right*: a route that renders its shell
 * and an empty body passes here, and so does every colour and layout defect, which
 * is what `/workbench` and a pair of eyes are for. It opens one address, `/`, which
 * is enough only because this is a single-page application whose router imports every
 * page — the module that broke it is reached from the landing page like any other. A
 * lazily imported route would need its own line here, and nothing makes that fail.
 *
 * Not part of `npm run check`: it wants a browser, and that loop wants nothing but
 * Node. Measured 2026-09-16 on one machine: `dev` 4.8 s with `node_modules/.vite`
 * removed and 2.7 s warm, `dist` 0.6 s. CI runs both modes in the job that already
 * builds the handbook.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HANDBOOK = dirname(fileURLToPath(new URL('.', import.meta.url)));
const ROOT = join(HANDBOOK, '../..');

/** Where the page is judged to have mounted, and how long it is given to. */
const READY_MS = 60_000;
const POLL_MS = 250;

/**
 * The browsers this accepts, in the order it tries them.
 *
 * It **fails** rather than skipping when none is there. A check that quietly
 * passes on a machine without Chrome is a check that passes everywhere somebody
 * needs it to (ADR 0031: a check that cannot fail is deleted). `CHROME_PATH`
 * is the escape hatch for a browser installed somewhere else.
 */
const BROWSERS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];

const mode = process.argv[2] ?? 'dev';
if (mode !== 'dev' && mode !== 'dist') {
  console.error(`usage: node apps/handbook/scripts/renders.mjs [dev|dist] — got "${mode}"`);
  process.exit(2);
}

/** A free port, asked of the operating system rather than guessed. */
async function freePort() {
  const { createServer } = await import('node:net');
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/**
 * The dev server, started the way `npm run handbook` starts it.
 *
 * `createServer` from this package's own Vite and this package's own config, with
 * the working directory it expects — `vite.app.mjs` joins the app's stylesheet
 * onto `process.cwd()` for Uniwind, so a run from the repository root would build
 * a differently themed site from the one a person sees.
 */
async function devServer() {
  process.chdir(HANDBOOK);
  const { createServer } = await import('vite');
  const server = await createServer({
    root: HANDBOOK,
    server: { port: await freePort(), strictPort: true },
    logLevel: 'warn',
  });
  await server.listen();
  return { url: server.resolvedUrls.local[0], stop: () => server.close() };
}

/**
 * The built site, served the way GitHub Pages serves it.
 *
 * `serve-clean.mjs` and not a plain static server, for the reason its own header
 * gives: a server that maps no clean URLs makes a working site look broken.
 */
async function distServer() {
  const dist = join(HANDBOOK, 'dist');
  if (!existsSync(join(dist, 'index.html'))) {
    console.error(
      `apps/handbook/dist/index.html is missing — run \`npm run build:handbook\` first.`,
    );
    process.exit(1);
  }
  const port = await freePort();
  const child = spawn('node', [join(ROOT, 'screens/tools/serve-clean.mjs'), dist, String(port)], {
    stdio: 'ignore',
  });
  return { url: `http://localhost:${port}/`, stop: () => child.kill('SIGKILL') };
}

/** Headless Chrome, and a socket to drive it over. No dependency: the protocol is JSON. */
async function browser() {
  const profile = mkdtempSync(join(tmpdir(), 'handbook-renders-'));
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
    console.error(
      `No browser to look with. Tried ${candidates.join(', ')}.\n` +
        `Install Chrome or Chromium, or point CHROME_PATH at one. This check does not skip:\n` +
        `a machine with no browser is a machine that cannot tell whether the handbook renders.`,
    );
    rmSync(profile, { recursive: true, force: true });
    process.exit(1);
  }
  return { child, endpoint, profile };
}

/** The five protocol calls this needs, over the socket Chrome printed. */
async function attach(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let last = 0;
  const waiting = new Map();
  const faults = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) {
      waiting.get(message.id)(message.result ?? {});
      waiting.delete(message.id);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails;
      faults.push(detail.exception?.description ?? detail.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      faults.push(message.params.args.map((a) => a.description ?? a.value).join(' '));
    }
    // The browser's own log, which is where a request that never arrived shows
    // up. Without it a bundle served under a name nothing points at reads as "no
    // error at all", and the one fact that explains the blank page — a 404 on the
    // entry script — is the fact the report is missing.
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      const { text, url } = message.params.entry;
      faults.push(url ? `${text} — ${url}` : text);
    }
  });
  const call = (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const id = ++last;
      waiting.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return { call, faults, close: () => socket.close() };
}

async function main() {
  const server = mode === 'dev' ? await devServer() : await distServer();
  const { child, endpoint, profile } = await browser();
  const { call, faults, close } = await attach(endpoint);

  let verdict = { mounted: false, title: '', words: '' };
  try {
    const { targetId } = await call('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await call('Target.attachToTarget', { targetId, flatten: true });
    await call('Runtime.enable', {}, sessionId);
    await call('Log.enable', {}, sessionId);
    await call('Page.enable', {}, sessionId);
    await call('Page.navigate', { url: server.url }, sessionId);

    const deadline = Date.now() + READY_MS;
    while (Date.now() < deadline) {
      const { result } = await call(
        'Runtime.evaluate',
        {
          // `innerText` and not `textContent`, so a mounted-but-invisible shell
          // reads as empty rather than as a page.
          expression: `JSON.stringify({
            mounted: (document.getElementById('root')?.childElementCount ?? 0) > 0,
            title: document.title,
            words: (document.body?.innerText ?? '').replace(/\\s+/g, ' ').trim().slice(0, 120),
          })`,
          returnByValue: true,
        },
        sessionId,
      );
      verdict = JSON.parse(result?.value ?? '{"mounted":false,"title":"","words":""}');
      if (verdict.mounted && verdict.words.length > 0) break;
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  } finally {
    close();
    child.kill('SIGKILL');
    rmSync(profile, { recursive: true, force: true });
    await server.stop();
  }

  const where = mode === 'dev' ? '`npm run handbook`' : '`npm run build:handbook`';
  if (verdict.mounted && verdict.words.length > 0) {
    console.log(
      `${mode}: the handbook renders — “${verdict.title}”, ${verdict.words.slice(0, 60)}…`,
    );
    return;
  }

  console.error(
    `${mode}: #root is empty after ${READY_MS / 1000}s. ${where} serves a blank page.\n` +
      (faults.length
        ? `The browser said:\n${[...new Set(faults)].map((fault) => `  ${fault}`).join('\n')}`
        : `The browser reported no error, so the shell mounted nothing of its own accord.`),
  );
  process.exit(1);
}

await main();
process.exit(0);
