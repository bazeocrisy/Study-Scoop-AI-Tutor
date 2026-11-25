// Headless browser walkthrough of the area lesson (local server + Chromium via Playwright).
// Not part of `npm test`: it needs a Playwright install with Chromium. Run: npm run test:browser [screenshotDir]
// Covers: full lesson through review, responsive layout, assessment commands, unclear answers,
// the struggle path and parent notice, invalid-curriculum rejection, and Worker retry and resume.
// It never contacts a real Worker or AI service: protected-mode requests are answered in-process.
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {createHmac, randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import worker, {TutorSessions} from '../cloudflare/tutor-worker/worker.js';

const {chromium} = createRequire(import.meta.url)('playwright');
const shots = process.argv[2];
const port = 5300 + Math.floor(Math.random() * 400);
const origin = `http://localhost:${port}`;
const server = spawn(process.execPath, ['server/index.js', '--port', String(port)], {stdio: ['ignore', 'pipe', 'inherit']});
await new Promise(resolve => server.stdout.once('data', resolve));
const browser = await chromium.launch();
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`PASS ${name}`); }
  catch (e) { results.push(`FAIL ${name}: ${e.message.split('\n')[0]}`); }
};

async function open(width = 1366, height = 900) {
  const page = await browser.newPage({viewport: {width, height}});
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') page.errors.push(m.text()); });
  return page;
}
const ready = page => page.waitForFunction(() => !document.getElementById('start').disabled || document.getElementById('notice').textContent);
const idle = page => page.waitForFunction(() => !['Thinking…'].includes(document.getElementById('state').textContent));
async function type(page, text) { await page.fill('#answer', text); await page.press('#answer', 'Enter'); await idle(page); }
async function choose(page, text) { await page.click(`.option:text-is("${text}")`); await idle(page); }
async function tapBlanks(page, count = Infinity) {
  const tiles = page.locator('#diagram button.tile');
  const n = Math.min(await tiles.count(), count);
  for (let i = 0; i < n; i++) await tiles.nth(i).click();
}
const progress = page => page.textContent('#progress');
const speech = page => page.textContent('#speech');

async function teachAll(page) {
  await choose(page, 'Inside surface');
  await type(page, '1');
  await type(page, 'A gap leaves part of the surface out of the count');
  await choose(page, 'It misses some of the surface');
  await type(page, '15');
  await tapBlanks(page); await type(page, '12');
  await type(page, 'ten');
  await tapBlanks(page, 8); await page.click('#send'); await idle(page);
  await type(page, '4');
  await type(page, 'Squares fit together without spaces');
  await choose(page, 'Equal unit squares');
}

await check('full area lesson: 9 teaching ideas, 8 independent problems, review', async () => {
  const page = await open();
  await page.goto(origin + '/'); await ready(page);
  assert.equal(await page.title(), 'Study Scoop · Your Area Tutor');
  assert.equal(await page.textContent('#lesson-label'), 'MATH / CHAPTER 6 / LESSON 1');
  await page.click('#start'); await idle(page);
  assert.equal(await progress(page), '1 of 9 teaching ideas');
  await choose(page, 'Boundary');
  assert.equal(await progress(page), '1 of 9 teaching ideas');
  assert.equal(await page.isHidden('#example'), false, 'alternative example shown after a wrong answer');
  await teachAll(page);
  assert.equal(await progress(page), '1 of 8 independent problems');
  // Assessment commands and unclear speech must not be recorded.
  for (const said of ['I need help', 'can you help me', "I don't know", 'twelve or fifteen', 'um']) {
    await type(page, said);
    assert.equal(await progress(page), '1 of 8 independent problems', said);
  }
  await type(page, 'hold on');
  assert.equal(await page.textContent('#pause'), 'Resume');
  await page.click('#pause'); await idle(page);
  await type(page, 'eight');
  await choose(page, 'Use equal unit squares with no gaps or overlaps');
  await tapBlanks(page); await type(page, '15');
  await type(page, '13');
  await type(page, 'one');
  await tapBlanks(page, 6); await page.click('#send'); await idle(page);
  await type(page, 'five');
  await type(page, 'Tiling covers the whole inside once, so gaps miss space and overlaps count twice.');
  const review = await page.textContent('#review');
  assert.match(review, /Independent work: 7 of 7 scored activities correct/);
  assert.doesNotMatch(review, /Ideas that still need teaching/);
  assert.equal((await page.locator('#review .example-visual .tiles').count()), 1, 'built figure redrawn on its own canvas');
  if (shots) await page.screenshot({path: `${shots}/review-1366.png`, fullPage: true});
  assert.deepEqual(page.errors, []);
  await page.close();
});

await check('responsive layout at 360, 768, 1024 and 1366 px: no horizontal overflow or errors', async () => {
  for (const width of [360, 768, 1024, 1366]) {
    const page = await open(width, 820);
    await page.goto(origin + '/'); await ready(page);
    await page.click('#start'); await idle(page);
    for (const step of [() => choose(page, 'Inside surface'), () => type(page, '1'), () => type(page, 'Gaps miss part of it'), () => choose(page, 'It misses some of the surface'), () => type(page, '15')]) await step();
    assert.equal(await progress(page), '5 of 9 teaching ideas');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(overflow, false, `overflow at ${width}`);
    if (shots) await page.screenshot({path: `${shots}/partial-${width}.png`, fullPage: true});
    assert.deepEqual(page.errors, [], `errors at ${width}`);
    await page.close();
  }
});

await check('struggling child: bounded retries, no dependent concepts, parent notice in review', async () => {
  const page = await open(768);
  await page.goto(origin + '/'); await ready(page);
  await page.click('#start'); await idle(page);
  for (let i = 0; i < 6; i++) await choose(page, 'Boundary');
  const review = await page.textContent('#review');
  assert.match(review, /Ideas that still need teaching/);
  assert.match(review, /Cover the inside/);
  assert.match(review, /not started yet/);
  assert.match(review, /Independent work: 0 of 0/);
  if (shots) await page.screenshot({path: `${shots}/struggle-768.png`, fullPage: true});
  await page.close();
});

await check('invalid curriculum is rejected in the browser', async () => {
  const page = await open();
  await page.route('**/curriculum/6-1.json', async route => {
    const lesson = await (await route.fetch()).json();
    lesson.concepts[6].check.answer = 99; // larger than its canvas
    await route.fulfill({json: lesson});
  });
  await page.goto(origin + '/'); await ready(page);
  assert.equal(await page.isDisabled('#start'), true);
  assert.match(await page.textContent('#notice'), /could not load/);
  await page.close();
});

await check('protected Worker: failed turn keeps the answer for Retry, and reload resumes the saved position', async () => {
  const secret = 'browser-walkthrough-fixture-secret-not-real';
  const data = new Map();
  const ctx = {blockConcurrencyWhile: fn => fn(), storage: {get: async k => structuredClone(data.get(k)), put: async (k, v) => data.set(k, structuredClone(v)), setAlarm: async () => {}, getAlarm: async () => null, list: async () => data, delete: async k => data.delete(k)}};
  const env = {SESSION_SIGNING_SECRET: secret, ALLOWED_ORIGINS: origin, AI_ENABLED: 'false'};
  const coordinator = new TutorSessions(ctx, env); env.TUTOR_SESSIONS = {idFromName: () => 1, get: () => coordinator};
  const payload = Buffer.from(JSON.stringify({lesson: '6-1', jti: randomUUID(), exp: Math.floor(Date.now() / 1000) + 3000})).toString('base64url');
  const token = payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
  let failNext = false;
  const handler = async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({status: 204, headers: {'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type, authorization'}});
    if (failNext) { failNext = false; return route.abort('connectionreset'); }
    await new Promise(r => setTimeout(r, 320)); // respect the Worker answer throttle
    const res = await worker.fetch(new Request('https://worker.test/api/tutor', {method: 'POST', headers: req.headers(), body: req.postData()}), env);
    await route.fulfill({status: res.status, headers: Object.fromEntries(res.headers), body: await res.text()});
  };
  const connect = async page => {
    await page.route('https://worker.test/**', handler);
    await page.goto(origin + '/'); await ready(page);
    await page.click('#parent summary');
    await page.fill('#endpoint', 'https://worker.test');
    await page.fill('#token', token);
    await page.click('#connect'); await idle(page);
    assert.equal(await page.textContent('#footer-mode'), 'Protected Worker session');
  };
  let page = await open();
  await connect(page);
  assert.equal(await progress(page), '1 of 9 teaching ideas');
  await choose(page, 'Inside surface');
  failNext = true;
  await page.fill('#answer', '1'); await page.press('#answer', 'Enter');
  await page.waitForSelector('#retry:not([hidden])');
  assert.match(await page.textContent('#notice'), /kept for retry/);
  assert.equal(await progress(page), '2 of 9 teaching ideas');
  await page.click('#retry'); await idle(page);
  assert.equal(await progress(page), '3 of 9 teaching ideas');
  await type(page, 'I need help');
  assert.equal(await progress(page), '3 of 9 teaching ideas');
  await page.close();
  page = await open(360);
  await connect(page);
  assert.equal(await progress(page), '3 of 9 teaching ideas', 'resumed after reload');
  assert.match(await speech(page), /Tiling means covering a figure/);
  assert.deepEqual(page.errors.filter(e => !/ERR_CONNECTION_RESET|Failed to load resource/.test(e)), []);
  await page.close();
});

await browser.close();
server.kill();
console.log(results.join('\n'));
const failed = results.filter(r => r.startsWith('FAIL')).length;
console.log(`${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
