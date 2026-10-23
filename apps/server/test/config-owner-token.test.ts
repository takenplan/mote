import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeConfigDocument } from '@mote/shared/config-file';
import { buildApp } from '../src/app.js';
import { ConfigService } from '../src/config-service.js';
import { configFromFile, configFromDocument, readConfigDocument, registerBuiltinDomains } from '../src/config.js';

async function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'mote-managed-owner-config-')), file = join(directory, 'mote.yaml'), vault = join(directory, 'vault');
  const ownerToken = 'generated-managed-owner-token-for-collision-fixtures';
  writeFileSync(file, 'version: 1\nrevision: 0\nstorage:\n  dataDir: ./vault\n');
  mkdirSync(vault); writeFileSync(join(vault, 'access-token'), ownerToken + '\n');
  const pure = configFromFile(file, { initializeCredentials: false }); assert.equal(pure.token, '');
  const service = new ConfigService({ path: file, watch: false }); registerBuiltinDomains(service, pure); await service.initialize();
  const initialized = configFromDocument(service.document(), file); assert.equal(initialized.token, ownerToken);
  const node = await buildApp(initialized, { configService: service, backgroundWorker: false });
  t.after(async () => { await node.app.close(); rmSync(directory, { recursive: true, force: true }); });
  return { node, service, file, ownerToken, headers: { authorization: 'Bearer ' + ownerToken } };
}

test('a pure bootstrap binds subsequent generic saves and external reloads to its managed owner credential', async t => {
  const f = await fixture(t), original = readFileSync(f.file, 'utf8');
  const response = await f.node.app.inject({ method: 'PUT', url: '/api/configuration/connectors', headers: f.headers, payload: { revision: f.service.revision, value: { mcpEnabled: true, mcpReadToken: f.ownerToken } } });
  assert.equal(response.statusCode, 400, response.body); assert.equal(response.json().error, 'config_invalid');
  assert.equal(readFileSync(f.file, 'utf8'), original); assert.equal(f.service.revision, 0); assert.equal(response.body.includes(f.ownerToken), false);
  const candidate = readConfigDocument(f.file); candidate.connectors = { ...f.service.saved<object>('connectors'), mcpEnabled: true, mcpReadToken: f.ownerToken };
  writeFileSync(f.file, serializeConfigDocument(candidate));
  await assert.rejects(f.service.reload(), (error: { code?: string }) => error.code === 'config_invalid');
  assert.equal(f.service.current<{ mcpEnabled: boolean }>('connectors').mcpEnabled, false); assert.equal(f.service.revision, 0);
  assert.equal(JSON.stringify(f.service.view()).includes(f.ownerToken), false);
});

test('a pending replacement owner token cannot permit MCP to reuse the still-effective private owner credential', async t => {
  const f = await fixture(t), replacementOwner = 'generated-pending-owner-token-for-collision-fixtures';
  const saved = await f.node.app.inject({ method: 'PUT', url: '/api/configuration/server', headers: f.headers, payload: { revision: 0, value: { token: replacementOwner } } });
  assert.equal(saved.statusCode, 200, saved.body); assert.equal(f.service.revision, 1);
  assert.equal(f.service.current<{ token: string }>('server').token, ''); assert.equal(f.service.saved<{ token: string }>('server').token, replacementOwner);
  const original = readFileSync(f.file, 'utf8');
  for (const token of [f.ownerToken, replacementOwner]) {
    const response = await f.node.app.inject({ method: 'PUT', url: '/api/configuration/connectors', headers: f.headers, payload: { revision: f.service.revision, value: { mcpEnabled: true, mcpReadToken: token } } });
    assert.equal(response.statusCode, 400, response.body); assert.equal(response.json().error, 'config_invalid');
    assert.equal(readFileSync(f.file, 'utf8'), original); assert.equal(f.service.revision, 1); assert.equal(response.body.includes(token), false);
  }
  const candidate = readConfigDocument(f.file); candidate.connectors = { ...f.service.saved<object>('connectors'), mcpEnabled: true, mcpReadToken: f.ownerToken };
  writeFileSync(f.file, serializeConfigDocument(candidate)); await assert.rejects(f.service.reload(), { code: 'config_invalid' });
  assert.equal(f.service.current<{ mcpEnabled: boolean }>('connectors').mcpEnabled, false);
  assert.equal((await f.node.app.inject({ url: '/api/configuration', headers: f.headers })).statusCode, 200, 'the original owner remains the effective authority until restart');
});

test('MCP write credentials are also checked against the actual owner after pure bootstrap', async t => {
  const f = await fixture(t), original = readFileSync(f.file, 'utf8');
  const response = await f.node.app.inject({ method: 'PUT', url: '/api/configuration/connectors', headers: f.headers, payload: { revision: f.service.revision, value: { mcpEnabled: true, mcpReadToken: 'generated-distinct-read-token-for-fixtures', mcpWriteEnabled: true, mcpWriteToken: f.ownerToken, mcpWriteSourceIds: ['generated'] } } });
  assert.equal(response.statusCode, 400, response.body); assert.equal(response.json().error, 'config_invalid');
  assert.equal(readFileSync(f.file, 'utf8'), original); assert.equal(f.service.revision, 0); assert.equal(response.body.includes(f.ownerToken), false);
});

for (const nestedValue of [undefined, 'generated-value-must-not-be-substituted']) test(`effective bootstrap credentials keep literal reference-shaped contents when the nested variable is ${nestedValue === undefined ? 'missing' : 'defined'}`, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'mote-literal-credential-')), file = join(directory, 'mote.yaml');
  const originalOwner = process.env.MOTE_FIXTURE_LITERAL_OWNER, originalNested = process.env.MOTE_FIXTURE_OTHER;
  const ownerToken = 'generated-owner-${MOTE_FIXTURE_OTHER}-credential-of-sufficient-length';
  process.env.MOTE_FIXTURE_LITERAL_OWNER = ownerToken;
  if (nestedValue === undefined) delete process.env.MOTE_FIXTURE_OTHER; else process.env.MOTE_FIXTURE_OTHER = nestedValue;
  let node: Awaited<ReturnType<typeof buildApp>> | undefined, service: ConfigService | undefined;
  t.after(async () => { await node?.app.close(); await service?.close(); if (originalOwner === undefined) delete process.env.MOTE_FIXTURE_LITERAL_OWNER; else process.env.MOTE_FIXTURE_LITERAL_OWNER = originalOwner; if (originalNested === undefined) delete process.env.MOTE_FIXTURE_OTHER; else process.env.MOTE_FIXTURE_OTHER = originalNested; rmSync(directory, { recursive: true, force: true }); });
  writeFileSync(file, 'version: 1\nrevision: 0\nserver:\n  token: ${MOTE_FIXTURE_LITERAL_OWNER}\nstorage:\n  dataDir: ./vault\n');
  const pure = configFromFile(file, { initializeCredentials: false }); assert.equal(pure.token, ownerToken);
  service = new ConfigService({ path: file, watch: false }); registerBuiltinDomains(service, pure); await service.initialize();
  const initialized = configFromDocument(service.document(), file); assert.equal(initialized.token, ownerToken);
  node = await buildApp(initialized, { configService: service, backgroundWorker: false });
  const response = await node.app.inject({ url: '/api/configuration', headers: { authorization: 'Bearer ' + ownerToken } });
  assert.equal(response.statusCode, 200, response.body); assert.equal(response.body.includes(ownerToken), false);
  assert.equal(readFileSync(file, 'utf8').includes('${MOTE_FIXTURE_LITERAL_OWNER}'), true);
  if (nestedValue !== undefined) assert.equal((await node.app.inject({ url: '/api/configuration', headers: { authorization: 'Bearer ' + ownerToken.replace('${MOTE_FIXTURE_OTHER}', nestedValue) } })).statusCode, 401);
});
