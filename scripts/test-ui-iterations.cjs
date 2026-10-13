/**
 * Actual Central renderer, isolated loopback server, generated evidence only.
 * Build first: npm run build:central
 * Run: node_modules/.bin/electron scripts/test-ui-iterations.cjs --round baseline
 * Add --review to retain the synthetic node for an independent browser evaluator.
 * This records UI journey evidence. It does not assign model/human quality scores.
 */
require('./fixture-language.cjs');
const { app, BrowserWindow } = require('electron');
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { randomBytes, randomUUID } = require('node:crypto');
const net = require('node:net');
const assert = require('node:assert/strict');

const args = process.argv.slice(2);
const roundIndex = args.indexOf('--round');
const round = roundIndex >= 0 ? args[roundIndex + 1] : 'baseline';
assert.match(round || '', /^[a-z0-9][a-z0-9_-]{0,40}$/i, 'Use a simple round label');
const review = args.includes('--review') || args.includes('--review-hold');
const repo = resolve(__dirname, '..');
const root = mkdtempSync(join(tmpdir(), 'mote-ui-eval-'));
const output = join(repo, '.mote', 'ui-iterations', round);
mkdirSync(output, { recursive: true, mode: 0o700 });
writeFileSync(join(output, 'result.json'), JSON.stringify({ round, passed: null, phase: 'running', generatedOnly: true }, null, 2), { mode: 0o600 });
app.setPath('userData', join(root, 'browser'));
app.on('window-all-closed', () => {});
let server, window, endpoint, request;
const errors = [], journeys = [], captures = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn, label) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await delay(80);
  }
  throw Error('Timed out: ' + label);
}
async function freePort() {
  return new Promise((resolvePort, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const selected = listener.address().port;
      listener.close(() => resolvePort(selected));
    });
  });
}
const js = code => window.webContents.executeJavaScript(code);
const confirmFixtureScript = `(() => {
  let history=[];try {history=JSON.parse(sessionStorage.getItem('mote.fixtureConfirmHistory')||'[]');}catch{}
  window.__moteUiConfirmHistory=history;window.__moteUiConfirmDecision=false;
  window.confirm=message=>{
    const decision=window.__moteUiConfirmDecision===true;
    history.push({message:String(message),decision,simulated:true});
    sessionStorage.setItem('mote.fixtureConfirmHistory',JSON.stringify(history));
    return decision;
  };return true;
})()`;
async function chooseLanguage(next, accept, selector) {
  const before = await js("({locale:document.documentElement.lang,preference:localStorage.getItem('mote.language'),hash:location.hash,confirmations:JSON.parse(sessionStorage.getItem('mote.fixtureConfirmHistory')||'[]').length})");
  await js(confirmFixtureScript);
  await js(`(() => {
    const select=[...document.querySelectorAll('.language-selector select')].find(item=>item.getClientRects().length);
    if(!select)throw Error('Visible language selector is missing');
    window.__moteUiConfirmDecision=${accept};select.value=${JSON.stringify(next)};
    select.dispatchEvent(new Event('change',{bubbles:true}));return true;
  })()`);
  if (accept) await until(() => js(`document.documentElement.lang===${JSON.stringify(next)}&&!!document.querySelector(${JSON.stringify(selector)})`), 'actual language chooser reload');
  else {
    await delay(60);
    assert.equal(await js('document.documentElement.lang'), before.locale, 'Cancelling retains the rendered locale');
    assert.equal(await js("localStorage.getItem('mote.language')"), before.preference, 'Cancelling retains the saved locale');
    assert.equal(await js('location.hash'), before.hash, 'Cancelling retains the current route');
  }
  const history = await js("JSON.parse(sessionStorage.getItem('mote.fixtureConfirmHistory')||'[]')");
  assert.equal(history.length, before.confirmations + 1, 'The actual change handler requests confirmation');
  assert.equal(history.at(-1).decision, accept);
  assert.ok(history.at(-1).message.length > 0);
  journeys.push({ name: 'language ' + next + (accept ? ' accept' : ' cancel'),
    action: 'actual React language selector; fixture-only confirmation decision and prompt recorded',
    route: await js('location.hash'), status: accept ? 'reloaded-language' : 'locale-and-route-preserved' });
}
async function route(path, selector = '.content h1, .content h2') {
  await js(`location.hash=${JSON.stringify('#/' + path)};window.scrollTo(0,0);true`);
  await until(() => js(`!!document.querySelector(${JSON.stringify(selector)})`), 'route ' + path);
  await delay(180);
}
async function click(selector, expectedRoute, name) {
  await until(() => js(`(() => {
    const item = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
    if (!item || item.disabled || item.getAttribute('aria-disabled') === 'true') return false;
    item.scrollIntoView({block:'center'}); item.click(); return true;
  })()`), 'click ' + name);
  await until(() => js(`location.hash.startsWith(${JSON.stringify('#/' + expectedRoute)})`), 'destination ' + name);
  await delay(180);
  journeys.push({ name, action: 'clicked actual product control', route: await js('location.hash'), status: 'route-reached' });
}
async function clickLabel(labels, expectedRoute, name) {
  await until(() => js(`(() => {
    const labels=${JSON.stringify(labels)};
    const item=[...document.querySelectorAll('button,a[href]')].find(e => e.getClientRects().length && getComputedStyle(e).visibility!=='hidden' && labels.some(label => e.textContent.trim()===label || e.querySelector('strong')?.textContent.trim()===label));
    if(!item || item.disabled || item.getAttribute('aria-disabled')==='true') return false;
    item.scrollIntoView({block:'center'}); item.click(); return true;
  })()`), 'control ' + name);
  await until(() => js(`location.hash.startsWith(${JSON.stringify('#/' + expectedRoute)})`), 'destination ' + name);
  await delay(180);
  journeys.push({ name, action: 'clicked actual product control', route: await js('location.hash'), status: 'route-reached' });
}
async function capture(name) {
  await js('window.scrollTo(0,0); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const state = await js(`(() => {
    const visible=e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
    const controls=[...document.querySelectorAll('button,a[href],input,textarea,select,summary')].filter(visible);
    const firstScreenText=[];
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const node=walker.currentNode, parent=node.parentElement, text=node.textContent.trim();
      if(!text||!parent||!visible(parent)||parent.closest('script,style')) continue;
      const range=document.createRange();range.selectNodeContents(node);
      const box=range.getBoundingClientRect();
      if(box.bottom>0&&box.top<innerHeight&&box.right>0&&box.left<innerWidth) firstScreenText.push(text);
    }
    return {hash:location.hash,locale:document.documentElement.lang,viewport:{width:innerWidth,height:innerHeight,devicePixelRatio},
      overflow:document.documentElement.scrollWidth>innerWidth,
      headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(e=>({level:e.tagName,text:e.textContent.trim()})),
      firstScreenText,pageTextSummary:document.body.innerText.split('\\n').filter(Boolean).slice(0,65),
      controls:controls.map(e=>{const box=e.getBoundingClientRect();return {tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||e.getAttribute('placeholder')||'').trim().slice(0,180),href:e.getAttribute('href'),disabled:e.disabled||e.getAttribute('aria-disabled')==='true',aboveFold:box.top>=0&&box.bottom<=innerHeight,box:{x:box.x,y:box.y,width:box.width,height:box.height}};})};
  })()`);
  state.viewport.browserZoom = window.webContents.getZoomFactor();
  writeFileSync(join(output, name + '.png'), (await window.webContents.capturePage()).toPNG());
  writeFileSync(join(output, name + '.json'), JSON.stringify(state, null, 2), { mode: 0o600 });
  captures.push({ name, hash: state.hash, locale: state.locale, viewport: state.viewport, overflow: state.overflow });
  assert.equal(state.overflow, false, 'No horizontal page overflow: ' + name);
}
async function homeMatrix(state, language = 'zh') {
  for (const [width, height] of [[1440, 1000], [820, 620], [390, 844], [320, 740]]) {
    window.setSize(width, height);
    await until(() => js(`innerWidth === ${width}`), 'viewport ' + width);
    await delay(120);
    if (state === 'populated-home') {
      const visibleRecent = await js(`(() => {
        const rows=[...document.querySelectorAll('.home-record-list .capture-card')];
        return {total:rows.length,visible:rows.filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').length};
      })()`);
      assert.deepEqual(visibleRecent, { total: 4, visible: 4 }, 'All four recent records remain visible at ' + width);
    }
    await capture(state + '-' + language + '-' + width);
  }
  window.setSize(1440, 1000);
  await until(() => js('innerWidth === 1440'), 'desktop viewport');
}
async function authenticate(token) {
  await js("document.querySelector('.simple-welcome button').click();true");
  await until(() => js('!!document.querySelector(".connect-modal input[type=password]")'), 'real login dialog');
  assert.equal(await js("document.querySelector('.connect-modal input').type"), 'password', 'Credential field is masked');
  await capture('generated-login-dialog');
  await js(`(() => {
    const input=document.querySelector('.connect-modal input[type=password]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(token)});
    input.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await until(() => js("!!document.querySelector('.connect-modal form .button.primary:not(:disabled)')"), 'login submit enabled');
  await js("document.querySelector('.connect-modal form .button.primary').click();true");
  await until(() => js('!!document.querySelector(".home-page")'), 'authenticated home');
  assert.equal(await js('!!document.querySelector(".connect-modal")'), false, 'Successful login closes dialog');
  journeys.push({ name: 'generated central login', action: 'opened real login dialog, populated masked field and submitted actual form', route: await js('location.hash'), status: 'authenticated' });
  // The evaluator uses the real login UI in its own browser. Values never go to stdout.
  if (review) writeFileSync(join(root, 'connection.json'), JSON.stringify({ generatedOnly: true, endpoint, token, output }, null, 2), { mode: 0o600 });
}
async function key(keyCode) {
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode });
  if (keyCode === 'Enter') window.webContents.sendInputEvent({ type: 'char', keyCode: '\r' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode });
  await delay(15);
}
async function verifyGuideKeyboard(sections) {
  const placement = await js(`(() => {
    const index=document.querySelector('.guide-section-nav'), model=document.querySelector('.guide-model-start');
    return !!(index&&model&&(index.compareDocumentPosition(model)&Node.DOCUMENT_POSITION_FOLLOWING));
  })()`);
  assert.equal(placement, true, 'Purpose index is before optional AI setup');
  for (let index = 0; index < sections.length; index++) {
    await js("(() => {window.scrollTo(0,0);const heading=document.querySelector('.guide-heading h1');heading.tabIndex=-1;heading.focus();return true;})()");
    let reachable = false;
    for (let step = 0; step < 120; step++) {
      if (await js(`document.activeElement===document.querySelectorAll('.guide-section-nav button')[${index}]`)) { reachable = true; break; }
      await key('Tab');
    }
    assert.equal(reachable, true, 'Function index is keyboard reachable: ' + sections[index].id);
    await key('Enter');
    const target = 'guide-heading-' + sections[index].id;
    await until(() => js(`document.activeElement?.id===${JSON.stringify(target)}`), 'function section receives focus');
    await until(() => js(`(() => {const box=document.getElementById(${JSON.stringify(target)}).getBoundingClientRect();return box.top>=0&&box.top<innerHeight;})()`), 'section heading is in viewport');
    assert.equal(await js('location.hash'), '#/guide', 'Index scroll does not change route');
    journeys.push({ name: 'function index ' + sections[index].id, action: 'native Chromium Tab and Enter; destination heading focus and viewport verified', route: '#/guide', status: 'keyboard-reached' });
  }
}
async function run() {
  await app.whenReady();
  endpoint = 'http://127.0.0.1:' + await freePort();
  const token = randomBytes(32).toString('hex');
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('MOTE_')) delete env[key];
  server = spawn('node', [join(repo, 'apps/server/dist/index.js')], {
    cwd: repo, env: { ...env, MOTE_PROFILE: 'test', MOTE_HOST: '127.0.0.1', MOTE_PORT: new URL(endpoint).port,
      MOTE_DATA_DIR: join(root, 'data'), MOTE_TOKEN: token }, stdio: ['ignore', 'ignore', 'pipe'],
  });
  let startupError = '';
  server.stderr.on('data', value => { startupError += value; });
  await until(async () => {
    if (server.exitCode !== null) throw Error('Generated node exited: ' + startupError.slice(-1600));
    try { return (await fetch(endpoint + '/api/health')).ok; } catch { return false; }
  }, 'isolated Central startup');
  request = async (path, body) => {
    const response = await fetch(endpoint + path, { method: body ? 'POST' : 'GET', headers: {
      Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'X-Mote-Ingress-Version': '2',
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(response.ok, 'Fixture API ' + path + ': ' + response.status);
    return response.json();
  };
  window = new BrowserWindow({ width: 1440, height: 1000, show: false, webPreferences: {
    contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false,
  } });
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); });
  // Simulated confirmation avoids native system dialogs in this background-only fixture.
  window.webContents.on('did-finish-load', () => { void js(confirmFixtureScript).catch(() => {}); });
  await window.loadURL(endpoint);
  await until(() => js('!!document.querySelector(".simple-welcome")'), 'signed-out welcome');
  await homeMatrix('signed-out');
  await chooseLanguage('en', false, '.simple-welcome');
  await chooseLanguage('en', true, '.simple-welcome');
  await homeMatrix('signed-out', 'en');
  await chooseLanguage('zh-CN', true, '.simple-welcome');
  await authenticate(token);
  await homeMatrix('empty-home');
  await chooseLanguage('en', true, '.home-page');
  await homeMatrix('empty-home', 'en');
  await chooseLanguage('zh-CN', true, '.home-page');

  // Route entry journeys run from first use through the current user-facing controls.
  for (const [labels, path, name] of [
    [['新增数据源'], 'connections/add', 'add source'],
    [['导入资料', '导入文件'], 'library/import', 'import existing files'],
    [['写随手记', '随手记'], 'library/notes', 'quick note'],
    [['全部功能与设置'], 'guide', 'all features and settings'],
  ]) {
    await route('today', '.home-page');
    await clickLabel(labels, path, name);
    await capture(name.replaceAll(' ', '-'));
  }
  await until(() => js('document.querySelectorAll("[data-guide-group]").length>0'), 'function catalog');
  const catalog = await js(`({groups:[...document.querySelectorAll('[data-guide-group]')].map(e=>e.dataset.guideGroup),units:[...document.querySelectorAll('[data-capability-id]')].map(e=>e.dataset.capabilityId),links:[...document.querySelectorAll('.feature-guide a[href]')].map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})),unavailable:[...document.querySelectorAll('.feature-guide [aria-disabled="true"]')].map(e=>e.textContent.trim())})`);
  const catalogSource = readFileSync(join(repo, 'apps/web/src/feature-guide-catalog.ts'), 'utf8');
  const catalogMatch = catalogSource.match(/export const guideSections:GuideSection\[\] = (\[[\s\S]*?\n\]);/);
  assert.ok(catalogMatch, 'Authored feature catalog is readable');
  const expectedCatalog = JSON.parse(catalogMatch[1]);
  assert.equal(catalog.groups.length, expectedCatalog.flatMap(section => section.groups).length, 'Every authored group is rendered');
  assert.equal(catalog.units.length, expectedCatalog.flatMap(section => section.groups.flatMap(group => group.units)).length, 'Every authored function is retained');
  writeFileSync(join(output, 'feature-coverage.json'), JSON.stringify(catalog, null, 2), { mode: 0o600 });
  await verifyGuideKeyboard(expectedCatalog);

  for (const [href, name] of [
    ['#/ask', 'ask'],
    ['#/library?view=memories', 'memory'],
    ['#/library/insights', 'insights'],
  ]) {
    await route('today', '.home-page');
    await click(`.home-page a[href="${href}"]`, href.slice(2), name);
    await capture(name);
  }
  await route('today', '.home-page');
  await clickLabel(['Mote 后台工作', '活动'], 'activity', 'background work');
  await capture('activity');
  await route('today', '.home-page');
  await click('.settings-nav,.mobile-settings', 'preferences', 'settings');
  await capture('settings');
  await clickLabel(['模型与服务'], 'system/models', 'model services');
  await capture('model-services');

  // Seed only after empty state evidence. Real ingress and publication are used.
  const seedTime = Date.now() - 60000;
  await request('/api/devices/heartbeat', { deviceId: 'generated-ui-phone', deviceName: 'Generated phone', platform: 'android', status: 'paused', queueDepth: 0,
    sync: { mode: 'manual', state: 'idle', intervalMinutes: 15, batchSize: 20, pendingRecords: 0, lastUploadAt: new Date().toISOString() } });
  await request('/api/sources', { id: 'generated-ui-coding', name: 'Generated Coding session', kind: 'coding-agent', deviceId: 'generated-ui-mac', platform: 'macos' });
  await request('/api/sources/generated-ui-coding/items/batch', { items: [0, 1].map(i => ({ externalId: 'event-' + i, revision: '1', observedAt: new Date(seedTime - 60000 + i * 10).toISOString(), kind: 'message', layer: 'original',
    text: i ? 'Generated assistant: the archive retains readable source evidence.' : 'Generated user: make a simple personal archive.',
    document: { contentRole: 'transcript', coding: { version: 1, provider: 'codex', projectKey: 'generated-project', sessionId: 'generated-session', eventId: 'event-' + i,
      role: i ? 'assistant' : 'user', attribution: i ? 'agent' : 'human', ...(i ? { channel: 'final' } : {}), part: 0, parts: 1 } } })) });
  await until(async () => (await request('/api/materials')).items.length > 0, 'generated material publication');
  for (let index = 0; index < 4; index++) {
    await request('/api/notes', { id: randomUUID(), deviceId: 'generated-ui-phone', deviceName: 'Generated phone', platform: 'android',
      capturedAt: new Date(seedTime + index * 10).toISOString(), text: `生成资料 ${index + 1}：周末在河边读书，计划整理旅行照片。Generated UI evaluation note ${index + 1}.` });
  }
  await js("location.hash='#/today';location.reload();true");
  await until(() => js('!!document.querySelector(".home-page")'), 'populated reload');
  await route('today', '.home-page');
  await until(() => js('document.querySelectorAll(".home-record-list .capture-card").length===4'), 'four generated recent rows');
  await homeMatrix('populated-home');
  await click('.sidebar nav button:nth-child(2)', 'library', 'library');
  await until(() => js('!!document.querySelector(".library-record")'), 'generated published material');
  await capture('library');
  await click('.library-record', 'library', 'read generated evidence');
  await until(() => js('!!document.querySelector(".material-detail")'), 'material body');
  await capture('material-detail');
  await route('today', '.home-page');
  await chooseLanguage('en', true, '.home-page');
  await homeMatrix('populated-home', 'en');
  window.webContents.setZoomFactor(2); await delay(150); await capture('populated-home-en-200-percent');
  window.webContents.setZoomFactor(1);
  await chooseLanguage('zh-CN', true, '.home-page');
  await js(confirmFixtureScript);
  const confirmations = await js("JSON.parse(sessionStorage.getItem('mote.fixtureConfirmHistory')||'[]')");
  writeFileSync(join(output, 'language-confirmations.json'), JSON.stringify({ generatedOnly: true, simulatedConfirmations: true, confirmations }, null, 2), {mode: 0o600});
  assert.deepEqual(errors, [], 'No renderer errors');
  writeFileSync(join(output, 'result.json'), JSON.stringify({ round, passed: true, phase: 'completed', generatedOnly: true, captures, journeys,
    featureGroups: catalog.groups.length, featureUnits: catalog.units.length,
    validationBoundary: 'Actual renderer and generated ingress/publication. Language selector uses simulated confirmation decisions with the real change handler and reload; native modal handling is not validated. Route entry is not complete feature use. No physical capture, external account, or live model.' }, null, 2), { mode: 0o600 });
  console.log('PASS: UI journey evidence ' + round + ' → ' + output);
  if (review) {
    console.log('REVIEW READY: ' + endpoint + ' private bootstrap ' + join(root, 'connection.json'));
    await new Promise(resolveHold => { process.once('SIGTERM', resolveHold); process.once('SIGINT', resolveHold); });
  }
}
async function finish(code) {
  if (window && !window.isDestroyed()) window.destroy();
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolveExit => server.once('exit', resolveExit)), delay(5000)]);
  }
  rmSync(root, { recursive: true, force: true });
  app.exit(code);
}
run().then(() => finish(0)).catch(async error => {
  console.error(error);
  writeFileSync(join(output, 'result.json'), JSON.stringify({ round, passed: false, phase: 'failed', generatedOnly: true, captures, journeys, message: error.message }, null, 2), { mode: 0o600 });
  if (window && !window.isDestroyed()) {
    writeFileSync(join(output, 'failure.png'), (await window.webContents.capturePage()).toPNG());
    writeFileSync(join(output, 'failure.json'), JSON.stringify({ message: error.message, hash: await js('location.hash'), errors }, null, 2));
  }
  await finish(1);
});
