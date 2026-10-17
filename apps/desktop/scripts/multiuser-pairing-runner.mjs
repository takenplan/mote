import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {createHash} from 'node:crypto';
import {buildApp} from '../../server/src/app.ts';

// Run after the shared Desktop build: node --import tsx .../multiuser-pairing-runner.mjs
// All accounts, invitations, images, SQLite data and profiles are generated here.
const require = createRequire(import.meta.url), electron = require('electron'), QRCode = require('qrcode');
const directory = await mkdtemp(join(tmpdir(), 'mote-desktop-pairing-'));
const password = 'Generated-Desktop-pairing-012345';
const origin = 'http://127.0.0.1:47832';
const wire = {'x-mote-protocol-version': '2', 'x-mote-ingress-version': '3'};
const children = new Set(), hosts = [], passed = [];
let fixtureNumber = 0;
const sha = value => createHash('sha256').update(value).digest('hex');
const report = name => {passed.push(name); console.log('PASS Desktop pairing: ' + name);};
const objectContaining = (value, accept) => {
  if (!value || typeof value !== 'object') return;
  if (accept(value)) return value;
  for (const child of Object.values(value)) {const found = objectContaining(child, accept); if (found) return found;}
};

async function host(label) {
  const dataDir = join(directory, label);
  let clock = Date.now(), node;
  const open = async () => {
    // LoginHandoffs/Accounts capture the clock at construction. The production
    // composition and SQLite stay real; only generated fixture time advances.
    const realNow = Date.now;
    try {Date.now = () => clock; node = await buildApp({dataDir});}
    finally {Date.now = realNow;}
  };
  await open();
  await node.accounts.initialize('generated-admin', password);
  const api = (token, url, method = 'GET', payload) => node.app.inject({url, method, headers: {...wire, ...(token ? {authorization: 'Bearer ' + token} : {})}, ...(payload === undefined ? {} : {payload})});
  const login = async username => {
    const response = await api(undefined, '/api/auth/login', 'POST', {username, password, mode: 'client'});
    assert.equal(response.statusCode, 200, 'generated account login');
    return response.json();
  };
  const admin = await login('generated-admin');
  for (const name of ['a', 'b']) assert.equal((await api(admin.token, '/api/admin/accounts', 'POST', {username: 'generated-' + name, password})).statusCode, 200);
  const users = {a: await login('generated-a'), b: await login('generated-b')};
  const value = {
    get node() {return node;}, users, api,
    invite: async (owner = 'a', deviceId) => {
      const response = await api(users[owner].token, '/api/connections/invitations', 'POST', {serverUrl: origin, label: 'Generated Desktop invitation', ...(deviceId ? {deviceId} : {})});
      assert.equal(response.statusCode, 200, 'real invitation creation');
      return response.json();
    },
    async restart() {await node.app.close(); await open();},
    advance(ms) {clock += ms;},
    async close() {await node.app.close();},
  };
  hosts.push(value);
  return value;
}

async function launch(initialHost, profile = join(directory, 'profile-' + (++fixtureNumber))) {
  const running = spawn(electron, [resolve('apps/desktop/scripts/multiuser-pairing-native.cjs'), profile], {
    cwd: process.cwd(), env: {...process.env, MOTE_PROFILE: 'default'}, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  children.add(running);
  const calls = [], pending = new Map(), holds = new Set();
  let selectedHost = initialHost, next = 0, loaded = 0, exited = false, exitDescription = '', error = '', fault, failures = [], qrReads = 0;
  const opened = [];
  running.stderr.on('data', chunk => {error = (error + chunk).slice(-5000);});
  running.stdout.on('data', chunk => process.stdout.write(chunk));
  running.on('exit', (code, signal) => {
    exitDescription = 'code=' + code + ', signal=' + signal;
    exited = true; children.delete(running);
    for (const task of pending.values()) task.reject(Error('Generated Desktop exited'));
    pending.clear();
  });
  const send = message => {if (!exited && running.connected) running.send(message);};
  const answer = (message, response) => send({type: 'fetch-response', id: message.id, status: response.statusCode, headers: response.headers, body: response.rawPayload.toString('base64')});
  running.on('message', message => {
    if (message.type === 'loaded') loaded++;
    if (message.type === 'open-browser') opened.push(message.url);
    if (message.type === 'generated-qr-read') qrReads++;
    if (message.type === 'result' || message.type === 'fixture-ready') {
      const task = pending.get(message.id); pending.delete(message.id);
      if (message.error) task?.reject(Error(message.error)); else task?.resolve(message.value);
    }
    if (message.type === 'fetch') void (async () => {
      const url = new URL(message.url), body = message.body ? JSON.parse(Buffer.from(message.body, 'base64').toString('utf8')) : undefined;
      const call = {...message, path: url.pathname, payload: body, host: selectedHost};
      calls.push(call);
      assert.equal(url.origin, origin, 'invitation transport stays at explicitly confirmed origin');
      if (['/api/connections/redeem', '/api/login/poll', '/api/login/ack', '/api/connections/self'].includes(call.path)) assert.equal(message.redirect, 'error', 'pairing requests reject redirects');
      if (call.path === '/api/connections/redeem') {
        assert.equal((await stat(join(profile, 'connection-pending.enc'))).mode & 0o777, 0o600, 'pending PKCE is private to this local profile');
        const saved = JSON.parse(Buffer.from(await readFile(join(profile, 'connection-pending.enc'))).map(v => v ^ 90).toString());
        const pkce = objectContaining(saved, item => typeof item.verifier === 'string');
        assert(pkce && /^[A-Za-z0-9_-]{43}$/.test(pkce.verifier), 'PKCE verifier is durable before redeem POST');
        assert.equal(sha(pkce.verifier), body.challenge, 'persisted PKCE matches actual claim');
        assert(objectContaining(saved, item => item.code === body.code && item.deploymentId === body.expected.deploymentId && item.userId === body.expected.userId), 'immutable invitation is durable before redeem');
        assert(Object.hasOwn(saved, 'sourceBinding'), 'original configuration binding is durable before redeem');
      }
      const currentFault = fault?.path === call.path && !fault.hit ? fault : undefined;
      if (currentFault) {currentFault.hit = true; currentFault.call = call;}
      const response = await selectedHost.node.app.inject({url: url.pathname + url.search, method: message.method, headers: message.headers, ...(message.body ? {payload: Buffer.from(message.body, 'base64')} : {})});
      call.status = response.statusCode;
      if (response.statusCode === 200) {
        try {call.result = response.json();} catch {}
      }
      if (currentFault?.mode === 'loss') {send({type: 'fetch-response', id: message.id, error: 'Generated lost ' + call.path + ' response'}); return;}
      if (currentFault?.mode === 'hold') {
        currentFault.release = () => {holds.delete(currentFault); answer(message, response);};
        holds.add(currentFault); return;
      }
      if (currentFault?.mode === 'alter') {
        const value = response.json(); currentFault.alter(value);
        const raw = Buffer.from(JSON.stringify(value));
        answer(message, {statusCode: response.statusCode, headers: {...response.headers, 'content-length': String(raw.length)}, rawPayload: raw}); return;
      }
      answer(message, response);
    })().catch(cause => {failures.push(cause); send({type: 'fetch-response', id: message.id, error: 'Generated transport fixture rejected request'});});
  });
  const rpc = (type, rest) => new Promise((resolve, reject) => {
    if (exited) return reject(Error('Desktop exited: ' + error));
    const id = ++next; pending.set(id, {resolve, reject}); send({type, id, ...rest});
  });
  const js = code => rpc('execute', {code});
  const until = async (read, accept, label) => {
    const deadline = Date.now() + 20000; let last;
    for (;;) {
      if (failures.length) throw failures[0];
      if (exited) throw Error('Desktop exited during ' + label + ' (' + exitDescription + '): ' + error);
      try {last = await read(); if (accept(last)) return last;} catch (cause) {last = String(cause);}
      assert(Date.now() < deadline, label + ': ' + JSON.stringify(last) + ' ' + error);
      await delay(25);
    }
  };
  await until(() => Promise.resolve(loaded), value => value > 0, 'production Desktop document load');
  await until(() => js('Boolean(window.mote&&document.querySelector("#ask-login"))'), Boolean, 'production preload + renderer');
  const desktop = {
    profile, running, js, until, calls, opened,
    get qrReads() {return qrReads;},
    status: () => js('window.mote.status()'),
    pending: () => js('window.mote.pendingConnection()'),
    pointTo(value) {selectedHost = value;},
    fault(path, mode, alter) {fault = {path, mode, alter, hit: false}; return fault;},
    async faultHit(value) {return until(() => Promise.resolve(value.hit && (value.mode !== 'hold' || value.release)), Boolean, 'generated ' + value.path + ' fault reached');},
    async connectionPage() {
      await js('document.querySelector("[data-nav=connection]").click();true');
      await until(() => js('!document.querySelector("[data-page=connection]").hidden'), Boolean, 'connection page');
    },
    async preview(invitation, kind = 'paste') {
      await desktop.connectionPage();
      const before = calls.length;
      if (kind === 'paste') {
        await js(`document.querySelector('#connection-input').value=${JSON.stringify(invitation.uri)};document.querySelector('#connection-input').dispatchEvent(new Event('input'));document.querySelector('#connection-preview').click();true`);
      } else {
        const path = join(directory, 'invitation-' + (++fixtureNumber) + (kind === 'qr' ? '.png' : '.json'));
        const bytes = kind === 'qr' ? await QRCode.toBuffer(invitation.uri, {type: 'png', width: 640, margin: 4}) : Buffer.from(JSON.stringify(invitation.invitation));
        await writeFile(path, bytes, {mode: 0o600});
        await rpc('fixture-import', {value: {path, ...(kind === 'qr' ? {qr: invitation.uri, hash: sha(bytes)} : {})}});
        await js(`document.querySelector('#connection-${kind}').click();true`);
      }
      await until(() => js('!document.querySelector("#connection-confirmation").hidden'), Boolean, 'v2 ' + kind + ' preview');
      const shownOrigin = await js('document.querySelector("#connection-origin").textContent');
      assert(shownOrigin === origin || shownOrigin.startsWith(origin + ' · '), 'preview displays the exact confirmed origin');
      assert(shownOrigin.includes(invitation.invitation.userId) && shownOrigin.includes(invitation.invitation.deploymentId), 'preview displays the immutable account and deployment');
      assert.equal(await js('document.querySelector("#connection-connect").disabled'), true, 'origin confirmation is required');
      assert.equal(calls.slice(before).filter(call => ['/api/connections/redeem', '/api/login/poll', '/api/login/ack'].includes(call.path)).length, 0, 'preview never claims invitation');
    },
    async confirm() {
      await js('document.querySelector("#connection-confirm-origin").checked=true;document.querySelector("#connection-confirm-origin").dispatchEvent(new Event("change"));true');
      await until(() => js('!document.querySelector("#connection-connect").disabled'), Boolean, 'confirmed origin enables connect');
      await js('document.querySelector("#connection-connect").click();true');
    },
    async paired(owner, expectedHost = selectedHost) {
      const status = await until(desktop.status, value => value.config.account?.userId === expectedHost.users[owner].userId && value.config.account?.deploymentId === expectedHost.node.deploymentId, 'verified ' + owner + ' account publication');
      assert.equal(status.running, false, 'pairing never enables collection');
      assert.equal(opened.length, 0, 'creation consent avoids additional browser approval');
      await until(desktop.pending, value => !value, 'completed pending recovery cleanup');
      return status;
    },
    async recover() {
      await desktop.connectionPage();
      await until(() => js('Boolean(document.querySelector("#connection-recover")&&!document.querySelector("#connection-recover").hidden&&!document.querySelector("#connection-recover").disabled)'), Boolean, 'explicit recovery UI');
      await js('document.querySelector("#connection-recover").click();true');
    },
    async idle() {await until(() => js('!document.querySelector("#connection-preview").disabled'), Boolean, 'connection UI operation settled');},
    async login(owner) {
      await js('document.querySelector(\'[data-nav="ask"]\').click();true');
      await until(() => js('!document.querySelector("#ask-login").disabled'), Boolean, 'Ask login form ready');
      await js(`document.querySelector('#ask-username').value='generated-${owner}';document.querySelector('#ask-password').value=${JSON.stringify(password)};document.querySelector('#ask-login').click();true`);
      return until(desktop.status, value => value.config.account?.userId === selectedHost.users[owner].userId, 'actual Ask login ' + owner);
    },
    async kill() {
      for (const hold of holds) hold.release();
      if (exited) return;
      const done = new Promise(resolve => running.once('exit', resolve)); running.kill('SIGKILL'); await done;
    },
    async close() {
      if (exited) return;
      const done = new Promise(resolve => running.once('exit', resolve)); send({type: 'quit'}); await done;
      if (failures.length) throw failures[0];
    },
  };
  return desktop;
}

async function queuedNote(desktop, text) {
  await desktop.js('(async()=>{const s=await window.mote.status();await window.mote.configure({...s.config,syncMode:"manual",metadataEnabled:false});})()');
  return desktop.js(`(async()=>{const d=await window.mote.noteDraft();await window.mote.saveNote({...d,text:${JSON.stringify(text)},revision:1});return d.id;})()`);
}

try {
  const central = await host('central');
  // This is deliberately first: the old M14 consumer fails on production v2,
  // before any helper-only test could conceal its browser-login fallback.
  let desktop = await launch(central);
  const firstDevice = (await desktop.status()).config.deviceId;
  await desktop.preview(await central.invite());
  await desktop.confirm();
  let status = await desktop.paired('a');
  assert.equal(status.config.deviceId, firstDevice);
  const firstGrant = desktop.calls.find(call => call.path === '/api/login/poll' && call.result?.ready)?.result;
  assert(firstGrant, 'real M01 poll produced the device grant');
  assert.deepEqual(desktop.calls.filter(call => ['/api/connections/redeem', '/api/login/poll', '/api/connections/self', '/api/login/ack'].includes(call.path)).map(call => call.path).slice(0, 5), ['/api/connections/redeem', '/api/login/poll', '/api/connections/self', '/api/login/ack', '/api/connections/self'], 'actual transport verifies self before ACK and again before publication');
  assert.equal(desktop.calls.filter(call => call.path === '/api/login/requests').length, 0, 'device invitation consumes its existing creation consent');
  for (const path of ['/api/materials', '/api/connections', '/api/admin/accounts']) assert.equal((await central.api(firstGrant.token, path)).statusCode, 403, 'device cannot read private Central APIs');
  assert.equal((await central.api(firstGrant.token, '/api/connections/self')).json().credential.deviceId, firstDevice);
  report('v2 URI -> origin consent -> PKCE -> exact self -> ACK, no browser approval or private API capability');

  const note = await queuedNote(desktop, 'Generated A pairing queue');
  assert.equal((await desktop.status()).queueDepth, 1);
  await desktop.preview(await central.invite('a', firstDevice), 'json');
  await desktop.confirm();
  status = await desktop.paired('a');
  assert.equal(status.queueDepth, 1, 'same account reauthorization preserves its existing queue');
  assert.equal((await central.api(firstGrant.token, '/api/connections/self')).statusCode, 401, 'original device credential is revoked on replacement');
  report('real JSON import and explicit original-device reauthorization retain account queue');

  await desktop.preview(await central.invite('b'), 'qr');
  await desktop.confirm();
  assert.equal((await desktop.paired('b')).queueDepth, 0, 'B cannot observe A queue');
  assert.equal(desktop.qrReads, 1, 'actual QR import reads generated PNG at native boundary');
  await desktop.preview(await central.invite('a', firstDevice));
  await desktop.confirm();
  assert.equal((await desktop.paired('a')).queueDepth, 1, 'A queue reopens under A stable identity');
  await desktop.js('window.mote.retry()');
  assert.equal((await desktop.status()).queueDepth, 0);
  assert.equal((await central.api(central.users.a.token, '/api/captures/' + note)).statusCode, 200);
  assert.equal((await central.api(central.users.b.token, '/api/captures/' + note)).statusCode, 404);
  report('real QR image import switches A/B accounts while keeping upload ownership exact');
  await desktop.close();

  for (const path of ['/api/connections/redeem', '/api/login/poll', '/api/login/ack']) {
    desktop = await launch(central);
    const loss = desktop.fault(path, 'loss');
    await desktop.preview(await central.invite()); await desktop.confirm(); await desktop.faultHit(loss); await desktop.idle();
    assert(await desktop.pending(), 'lost response retains durable recovery state');
    const profile = desktop.profile, claims = desktop.calls.filter(call => call.path === '/api/connections/redeem').map(call => call.payload);
    const savedBefore = await readFile(join(profile, 'connection-pending.enc'));
    assert.doesNotMatch(savedBefore.toString('utf8'), /"verifier"|"token"|mote\.connection/, 'pending secret file uses encrypted safeStorage boundary');
    await desktop.kill();
    if (path === '/api/login/ack') await central.restart();
    desktop = await launch(central, profile);
    const before = desktop.calls.filter(call => ['/api/connections/redeem', '/api/login/poll', '/api/login/ack'].includes(call.path)).length;
    assert.equal((await desktop.status()).config.account, undefined, 'restart does not automatically publish pending account');
    await desktop.recover(); const recovered = await desktop.paired('a');
    const inventory = (await central.api(central.users.a.token, '/api/connections')).json().items;
    assert.equal(inventory.filter(item => item.deviceId === recovered.config.deviceId && !item.revokedAt).length, 1, 'lost response recovery mints exactly one live device credential');
    assert(desktop.calls.filter(call => ['/api/connections/redeem', '/api/login/poll', '/api/login/ack'].includes(call.path)).length > before, 'recovery uses the explicit UI action');
    const resumed = desktop.calls.find(call => call.path === '/api/connections/redeem');
    if (resumed) assert.deepEqual(resumed.payload, claims[0], 'lost redeem retries the exact durable claim');
    if (path === '/api/login/ack') {
      assert(desktop.calls.some(call => call.path === '/api/login/ack' && call.status === 410), 'Central restart exercises lost ACK 410 recovery');
      assert.equal(desktop.calls.filter(call => call.path === '/api/login/poll').length, 0, 'saved grant recovery never polls consumed request');
    }
    await desktop.close();
    report('lost ' + path.split('/').at(-1) + ' response -> SIGKILL -> explicit resume' + (path.endsWith('/ack') ? ' after Central restart / ACK 410' : ''));
  }

  desktop = await launch(central);
  await desktop.preview(await central.invite()); await desktop.confirm(); await desktop.paired('a');
  const restartDevice = (await desktop.status()).config.deviceId;
  await queuedNote(desktop, 'Generated A before pending B restart');
  const lostB = desktop.fault('/api/login/poll', 'loss');
  await desktop.preview(await central.invite('b')); await desktop.confirm(); await desktop.faultHit(lostB); await desktop.idle();
  assert.equal((await desktop.status()).config.account.userId, central.users.a.userId, 'failed B pairing preserves the existing A account');
  const ownerProfile = desktop.profile; await desktop.kill();
  desktop = await launch(central, ownerProfile);
  assert.equal((await desktop.status()).config.account.userId, central.users.a.userId, 'restarting with pending B does not replace current A');
  assert.equal((await desktop.status()).queueDepth, 1);
  assert.equal(desktop.calls.filter(call => ['/api/connections/redeem', '/api/login/poll', '/api/login/ack'].includes(call.path)).length, 0, 'pending B is never silently resumed on startup');
  await desktop.recover(); assert.equal((await desktop.paired('b')).queueDepth, 0);
  await desktop.preview(await central.invite('a', restartDevice)); await desktop.confirm();
  assert.equal((await desktop.paired('a')).queueDepth, 1);
  await desktop.close();
  report('pending B across SIGKILL preserves current A and its queue until explicit recovery');

  // Revocation after a valid self response has been read must still win before
  // local publication. The stale response is held at the network boundary.
  desktop = await launch(central);
  const revokeInvite = await central.invite(), heldRevoke = desktop.fault('/api/connections/self', 'hold');
  await desktop.preview(revokeInvite); await desktop.confirm(); await desktop.faultHit(heldRevoke);
  assert.equal((await central.api(central.users.a.token, '/api/connections/invitations/revoke', 'POST', {code: revokeInvite.invitation.code})).statusCode, 200);
  heldRevoke.release(); await desktop.idle();
  assert.equal((await desktop.status()).config.account, undefined, 'revoked invitation cannot publish from stale self');
  assert.equal((await desktop.status()).queueDepth, 0, 'revoked invitation cannot open an account queue');
  await desktop.close();
  report('revocation during in-flight self fences local account and queue publication');

  desktop = await launch(central);
  const expired = await central.invite();
  await desktop.preview(expired); central.advance(11 * 60000); await desktop.confirm(); await desktop.idle();
  assert.equal((await desktop.status()).config.account, undefined, 'server-expired invitation cannot publish configuration');
  await desktop.close();
  report('server expiry after preview leaves local account disconnected');

  // Tamper one field of an otherwise real production self response. Every
  // mismatch must fail before commit; no fake identity or approval host exists.
  for (const field of ['credential', 'account', 'device', 'purpose']) {
    desktop = await launch(central);
    desktop.fault('/api/connections/self', 'alter', value => {
      if (field === 'credential') value.account.credentialId = 'generated-wrong-credential';
      if (field === 'account') value.account.userId = central.users.b.userId;
      if (field === 'device') value.credential.deviceId = 'generated-wrong-device';
      if (field === 'purpose') value.credential.purpose = 'central';
    });
    await desktop.preview(await central.invite()); await desktop.confirm(); await desktop.idle();
    assert.equal((await desktop.status()).config.account, undefined, 'fresh self ' + field + ' mismatch blocks publication');
    assert.equal(desktop.calls.filter(call => call.path === '/api/login/ack').length, 0, 'mismatched fresh self is never ACKed');
    await desktop.close();
    report(field === 'purpose' ? 'unexpected Central-purpose field in self is rejected by exact response schema' : 'fresh self exact ' + field + ' mismatch blocks commit');
  }

  desktop = await launch(central);
  desktop.fault('/api/login/poll', 'alter', value => {value.purpose = 'central';});
  await desktop.preview(await central.invite()); await desktop.confirm(); await desktop.idle();
  assert.equal((await desktop.status()).config.account, undefined, 'Central-purpose grant cannot establish a device pairing');
  assert.equal(desktop.calls.filter(call => ['/api/connections/self', '/api/login/ack'].includes(call.path)).length, 0, 'wrong-purpose poll grant is rejected before it is used');
  await desktop.close();
  report('poll grant purpose must exactly match the invitation device purpose');

  desktop = await launch(central);
  const stale = desktop.fault('/api/connections/self', 'hold');
  await desktop.preview(await central.invite()); await desktop.confirm(); await desktop.faultHit(stale);
  await desktop.login('b'); stale.release();
  await desktop.until(desktop.status, value => value.config.account?.userId === central.users.b.userId && !value.operations?.some(operation => operation.id === 'mote:connection-confirm' && operation.state === 'running'), 'new B owner remains current after stale A operation finishes');
  assert.equal((await desktop.status()).config.account.userId, central.users.b.userId, 'late A self cannot overwrite B configuration');
  assert.equal((await desktop.status()).queueDepth, 0);
  assert.equal(desktop.calls.filter(call => call.path === '/api/login/ack').length, 0, 'retired A generation cannot ACK its delayed grant');
  await desktop.close();
  report('late A self callback after actual B login cannot change B owner');

  // A second real host with a new deployment ID occupies exactly the same URL.
  // Stable instance identity, rather than URL equality, chooses the local queue.
  const replacement = await host('replacement-central');
  desktop = await launch(central);
  await desktop.preview(await central.invite()); await desktop.confirm(); await desktop.paired('a');
  const originalDevice = (await desktop.status()).config.deviceId;
  await queuedNote(desktop, 'Generated old-instance note');
  desktop.pointTo(replacement);
  await desktop.preview(await replacement.invite()); await desktop.confirm();
  assert.equal((await desktop.paired('a', replacement)).queueDepth, 0, 'same URL new deployment never inherits old queue');
  assert.equal((await desktop.status()).config.deviceId, originalDevice);
  desktop.pointTo(central);
  await desktop.preview(await central.invite('a', originalDevice)); await desktop.confirm();
  assert.equal((await desktop.paired('a', central)).queueDepth, 1, 'returning to exact old deployment restores its own queue');
  await desktop.close();
  report('same URL replacement deployment keeps local queues isolated');

  console.log(JSON.stringify({ok: true, actualElectronMainPreloadRenderer: true, productionBuildAppAccountsSQLite: true, generatedExternalIOOnly: true, physicalCamera: false, realDeployment: false, scenarios: passed}));
} finally {
  await Promise.allSettled([...children].map(child => new Promise(resolve => {
    const timer = setTimeout(resolve, 3000); child.once('exit', () => {clearTimeout(timer); resolve();}); child.kill('SIGKILL');
  })));
  for (const value of hosts.reverse()) await value.close();
  await rm(directory, {recursive: true, force: true});
}
