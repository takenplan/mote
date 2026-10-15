import test from 'node:test';
import assert from 'node:assert/strict';
import {documentActivitySchema,sourceItemSchema} from '../dist/sources.js';
const at='2026-10-15T00:00:00.000Z',end='2026-10-15T01:00:00.000Z';
const activity={version:1,provider:'lark',documentId:'generated-doc',actor:{accountId:'a'.repeat(64)},action:'opened',evidenceBasis:'search-predicate',time:{precision:'range',start:at,end},observedAt:end,limitations:['provider-open-may-include-connector-access']};

test('document activities preserve provider scope, time bounds and account fingerprint without accepting attention or duration claims',()=>{
  assert.deepEqual(documentActivitySchema.parse(activity),activity);
  for(const value of [{...activity,actor:{username:'generated-private-name'}},{...activity,readingDuration:100},{...activity,finishedReading:true},{...activity,time:{precision:'exact',start:at,end}},{...activity,time:{precision:'range',start:end,end:at}},{...activity,time:{precision:'hour',start:at}},{...activity,time:{precision:'unknown',start:at}},{...activity,exactRevision:'current-body-is-not-human-proof'}])assert.equal(documentActivitySchema.safeParse(value).success,false,JSON.stringify(value));
  assert.equal(documentActivitySchema.safeParse({...activity,evidenceBasis:'provider-metadata',time:{precision:'exact',start:at},exactRevision:'provider-verified-revision'}).success,true);
});

test('activity evidence requires its own event item, separate from document text and Coding evidence',()=>{
  const item={externalId:'activity:generated',revision:'1',observedAt:end,kind:'event',layer:'derived',text:'Generated provider observation',document:{contentRole:'other',timeBasis:'unknown',activity}};
  assert.equal(sourceItemSchema.safeParse(item).success,true);
  assert.equal(sourceItemSchema.safeParse({...item,kind:'file'}).success,false);
  assert.equal(sourceItemSchema.safeParse({...item,document:{...item.document,coding:{version:1,provider:'codex',sessionId:'s',projectKey:'p',eventId:'e',role:'user',part:0,parts:1}}}).success,false);
});
