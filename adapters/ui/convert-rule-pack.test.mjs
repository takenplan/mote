import test from 'node:test';
import assert from 'node:assert/strict';
import {convertOfflineRulePack} from './convert-rule-pack.mjs';
const pack = rule => ({formatVersion: 1, appId: 'dev.generated', appVersion: '1.0.0', rules: [rule]});
const hash = 'a'.repeat(64);
const candidate = () => ({id: 'message-row', repeat: {resourceId: 'dev.generated:id/row', role: 'android.view.ViewGroup', subtreeHash: hash}, fields: [{name: 'quoted_message_body', select: {resourceId: 'dev.generated:id/quote'}, path: [0, 2], source: 'text', cardinality: 'many'}, {name: 'message_description', select: {role: 'android.widget.TextView'}, path: [], source: 'desc', cardinality: 'one'}]});
test('declarative conversion preserves exact version, structural guard, original path, source and cardinality', () => {
  const {rules, excluded} = convertOfflineRulePack(pack(candidate()));
  assert.deepEqual(excluded, []); assert.equal(rules[0].appVersion, '1.0.0');
  assert.equal(rules[0].repeatSubtreeHash, hash); assert.deepEqual(rules[0].repeat, {resourceId: 'dev.generated:id/row', role: 'android.view.ViewGroup'});
  assert.deepEqual(rules[0].fields.quoted_message_body.childPath, [0, 2]); assert.equal(rules[0].fields.quoted_message_body.cardinality, 'many');
  assert.equal(rules[0].fields.message_description.source, 'description'); assert.deepEqual(rules[0].fields.message_description.childPath, []);
});
test('nonportable whole-page hashes and unreviewed broad rules are excluded instead of widening extraction', () => {
  const guarded = {...candidate(), structureHashes: [hash]};
  assert.deepEqual(convertOfflineRulePack(pack(guarded)).excluded, [{id: 'message-row', reason: 'nonportable_whole_page_hash'}]);
  const loose = candidate(); delete loose.repeat;
  assert.equal(convertOfflineRulePack(pack(loose)).rules.length, 0);
  const unsupported = candidate(); unsupported.fields[0].textContains = 'Generated term';
  assert.throws(() => convertOfflineRulePack(pack(unsupported)), /Unsupported field constraint/);
});
