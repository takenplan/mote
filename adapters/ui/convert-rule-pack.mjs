import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

/** Convert declarative offline metadata only. Never read capture records or images. */
export function convertOfflineRulePack(pack) {
  if (pack.formatVersion !== 1 || typeof pack.appId !== 'string' || typeof pack.appVersion !== 'string' || !Array.isArray(pack.rules)) throw Error('Expected an exact-version offline rule pack');
  const rules = [], excluded = [];
  for (const candidate of pack.rules) {
    const reject = reason => excluded.push({id: candidate.id, reason});
    if (candidate.structureHashes) {reject('nonportable_whole_page_hash'); continue;}
    if (!candidate.repeat?.subtreeHash) {reject('requires_individual_native_selector_review'); continue;}
    if (!/^[a-f0-9]{64}$/.test(candidate.repeat.subtreeHash)) throw Error('Invalid subtree hash');
    const {subtreeHash, ...repeat} = candidate.repeat;
    if (Object.keys(repeat).some(key => !['resourceId', 'role'].includes(key)) || !Object.keys(repeat).length) throw Error('Unsupported repeat selector');
    if (candidate.required && (!Array.isArray(candidate.required) || candidate.required.length > 8 || candidate.required.some(selector => !Object.keys(selector).length || Object.keys(selector).some(key => !['resourceId', 'role'].includes(key))))) throw Error('Unsupported required selector');
    if (!Array.isArray(candidate.fields) || !candidate.fields.length || candidate.fields.length > 32) throw Error('Invalid fields');
    const fields = {};
    for (const field of candidate.fields) {
      if (!/^[a-z][a-z0-9_]{0,99}$/.test(field.name) || fields[field.name]) throw Error('Invalid or duplicate field name');
      if (!['text', 'desc'].includes(field.source) || !['one', 'many'].includes(field.cardinality)) throw Error('Unsupported field source or cardinality');
      for (const selector of [field.select, field.ancestor].filter(Boolean)) if (!Object.keys(selector).length || Object.keys(selector).some(key => !['resourceId', 'role'].includes(key))) throw Error('Unsupported field selector');
      if (field.path && (!Array.isArray(field.path) || field.path.length > 32 || field.path.some(index => !Number.isInteger(index) || index < 0 || index > 4095))) throw Error('Invalid original child path');
      if (Object.keys(field).some(key => !['name', 'select', 'ancestor', 'source', 'cardinality', 'path'].includes(key))) throw Error('Unsupported field constraint');
      fields[field.name] = {select: field.select, ...(field.ancestor ? {ancestor: field.ancestor} : {}), ...(field.path ? {childPath: field.path} : {}), source: field.source === 'desc' ? 'description' : 'text', cardinality: field.cardinality};
    }
    if (Object.keys(candidate).some(key => !['id', 'purpose', 'repeat', 'required', 'fields'].includes(key))) throw Error('Unsupported rule constraint');
    rules.push({formatVersion: 3, id: `${pack.appId}:${pack.appVersion}:${candidate.id}`, version: '1', platform: 'android', appId: pack.appId, appVersion: pack.appVersion, kind: candidate.id.replaceAll('-', '_'), repeat, repeatSubtreeHash: subtreeHash, ...(candidate.required ? {required: candidate.required} : {}), fields});
  }
  return {rules, excluded};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw Error('Usage: node adapters/ui/convert-rule-pack.mjs DECLARATIVE_RULE_PACK OUTPUT');
  const converted = convertOfflineRulePack(JSON.parse(readFileSync(input, 'utf8')));
  writeFileSync(output, JSON.stringify(converted.rules, null, 2) + '\n');
  console.error(JSON.stringify({converted: converted.rules.length, excluded: converted.excluded}, null, 2));
}
