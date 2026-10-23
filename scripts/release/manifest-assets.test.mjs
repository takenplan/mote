import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {tsImport} from 'tsx/esm/api';
import {manifestAsset} from './manifest-assets.mjs';

const {verifyReleaseEnvelope, RELEASE_KEY_ID} = await tsImport('../../packages/shared/src/release.ts', import.meta.url);
const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength:3072});
const identities = {
  central: {component:'server', platform:'source', arch:'all', format:'tar.gz', name:'mote-server-1.2.3.tar.gz'},
  desktop: {component:'desktop', platform:'darwin', arch:'arm64', format:'zip', name:'mote-desktop-macos-arm64-1.2.3.zip', bundleId:'dev.mote.collector', signing:'developer-id', teamId:'FIXTURE123'},
  android: {component:'android', platform:'android', arch:'arm64', format:'apk', name:'mote-android-arm64-1.2.3.apk', packageName:'dev.mote.collector', versionCode:42, certificateSha256:'a'.repeat(64)},
};
for (const [component, identity] of Object.entries(identities)) {
  test(`${component} CI build provenance projects into the unchanged strict signed asset schema`, () => {
    const repository = 'fixture/mote', version = '1.2.3', tag = `${component}-v${version}`;
    const asset = {...identity, url:`https://github.com/${repository}/releases/download/${tag}/${identity.name}`, size:123, sha256:'b'.repeat(64)};
    const metadata = Object.freeze({...asset, profile:'prod', commit:'c'.repeat(40), buildId:tag, build:{runner:'generated'}});
    const envelope = value => {
      const payload = Buffer.from(JSON.stringify({schemaVersion:1, component, version, repository, tag, channel:'stable', notesUrl:`https://github.com/${repository}/releases/tag/${tag}`, publishedAt:'2026-01-01T00:00:00.000Z', assets:[value], images:[]}));
      return JSON.stringify({schemaVersion:1, keyId:RELEASE_KEY_ID, payload:payload.toString('base64'), signature:sign('RSA-SHA256', payload, privateKey).toString('base64')});
    };
    const verify = value => verifyReleaseEnvelope(envelope(value), {publicKey, repository, component});
    assert.throws(() => verify(metadata), /invalid_release_manifest/);
    const projected = manifestAsset(metadata);
    assert.deepEqual(verify(projected).assets, [asset]);
    assert.throws(() => verify({...projected, profile:'prod'}), /invalid_release_manifest/);
    assert.throws(() => verify({...projected, size:'123'}), /invalid_release_manifest/);
    assert.equal(metadata.profile, 'prod');
  });
}
