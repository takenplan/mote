import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import {FeatureGuide} from '../src/FeatureGuide.js';
import {english} from '../../../packages/shared/src/i18n-en.js';
import {guideSections,quickLinks,type GuideTarget} from '../src/feature-guide-catalog.js';
import {settingsCategoryFromHash} from '../src/route-query.js';

const groups=guideSections.flatMap(section=>section.groups);
const units=groups.flatMap(group=>group.units);
const targets:GuideTarget[]=[...quickLinks,...groups.flatMap(group=>group.links),...units.flatMap(unit=>[unit.target,...unit.otherTargets,...unit.setupTargets])];
const ids=(prefix:string,count:number)=>Array.from({length:count},(_,index)=>prefix+String(index+1).padStart(2,'0'));
const targetText=(target:GuideTarget)=>[target.label,target.path,target.where];
const authoredText=[
  ...guideSections.flatMap(section=>[section.title,section.description]),
  ...groups.flatMap(group=>[group.title,group.purpose,group.setting]),
  ...units.flatMap(unit=>[unit.title,unit.purpose,...unit.actions,unit.setup,...unit.caveats,unit.condition]),
  ...targets.flatMap(targetText),
].filter((value):value is string=>value!==null);

test('the guide contains every reviewed group and capability ID exactly once',()=>{
  assert.deepEqual(groups.map(group=>group.id).sort(),ids('G',16));
  assert.deepEqual(units.map(unit=>unit.id).sort(),[...ids('A',36),...ids('C',42)]);
  assert.equal(new Set(guideSections.map(section=>section.id)).size,guideSections.length);
  for(const group of groups){
    assert.ok(group.units.length>0,group.id);
    for(const unit of group.units){
      assert.ok(['core','advanced'].includes(unit.priority),unit.id);
      assert.ok(unit.actions.length>0,unit.id);
    }
  }
});

test('dynamic guide presentation keys have nonempty English translations',()=>{
  const keys=[...new Set(authoredText.filter(value=>/\p{Script=Han}/u.test(value)))];
  assert.ok(keys.length>0,'the authored catalog contains localized copy');
  const missing=keys.filter(key=>!Object.hasOwn(english,key));
  assert.equal(missing.length,0,'missing dynamic Guide translations: '+missing.slice(0,10).join(' | '));
  for(const key of keys){
    assert.ok(english[key].trim(),key);
    assert.doesNotMatch(english[key],/\p{Script=Han}/u,key);
    assert.deepEqual(english[key].match(/\{\d+\}/g)?.sort()??[],key.match(/\{\d+\}/g)?.sort()??[],key);
  }
});

test('guide targets carry explicit local destinations and matching collection or settings category query state',()=>{
  for(const target of targets){
    assert.ok(target.pageId.trim(),target.label);
    assert.match(target.href,/^#\/[^?#\s]+(?:\?[^#\r\n]*)?$/,target.label);
    assert.ok(target.label.trim(),target.href);
    assert.ok(target.path.trim(),target.href);
    assert.equal(typeof target.where,'string',target.href);
    const query=new URLSearchParams(target.href.split('?')[1]);
    if(target.collectionId){
      assert.equal(target.pageId,'archive',target.href);
      assert.equal(query.get('view'),target.collectionId,target.href);
    }else assert.equal(query.has('view'),false,target.href);
    if(target.categoryId){
      assert.equal(target.pageId,'settings',target.href);
      assert.equal(query.get('category'),target.categoryId,target.href);
      assert.equal(settingsCategoryFromHash(target.href),target.categoryId,target.href);
    }else assert.equal(query.has('category'),false,target.href);
    for(const requirement of target.requires??[]){
      if(typeof requirement==='string')assert.ok(requirement.trim(),target.href);
      else{
        assert.ok(requirement.id.trim(),target.href);
        assert.ok(requirement.version.trim(),target.href);
        assert.ok(requirement.host===undefined||requirement.host==='server'||requirement.host==='local',target.href);
      }
    }
  }
});

test('note attachments describe existing files and Coding progress keeps its specific requirement on the work-activity destination',()=>{
  const attachments=units.find(unit=>unit.id==='C13');
  assert.ok(attachments);
  assert.equal(attachments.target.pageId,'notes');
  assert.match(attachments.title,/已有图片或音频/);
  assert.ok(attachments.actions.includes('选择并上传已有图片或音频文件'));
  assert.ok(attachments.caveats.includes('随手记附件入口用于上传已有文件。'));
  const coding=units.find(unit=>unit.id==='A15');
  assert.ok(coding);
  assert.equal(coding.target.pageId,'archive');
  assert.equal(coding.target.collectionId,'work-activity');
  assert.equal(new URLSearchParams(coding.target.href.split('?')[1]).get('view'),'work-activity');
  assert.deepEqual(coding.target.requires,['http:GET:/api/coding/uploads']);
  assert.ok(coding.otherTargets.some(target=>target.collectionId==='materials'),'published conversation content has an explicit destination');
});


test('English Guide terminology labels stay separate from the complete explanations',t=>{
  configureLocale(()=> 'en');t.after(()=>configureLocale(()=> 'zh-CN'));
  const dom=new JSDOM(renderToStaticMarkup(React.createElement(FeatureGuide,{api:{} as any,onPage:()=>{}})));
  const terms=dom.window.document.querySelector('.guide-model-terms')!;
  assert.equal(terms.querySelectorAll('strong').length,4);
  for(const label of terms.querySelectorAll('strong'))assert.match(label.nextSibling?.textContent??'',/^\s+\S/,'Complete term label has a word boundary before its explanation');
  assert.ok(terms.textContent?.includes(english['保存服务地址、凭据与可用模型；']));
  assert.ok(terms.textContent?.includes(english['是当前运行的整体实现，由可信组件和实例组成。并发、超时及其他执行参数在相应高级设置中按需调整。']));
  dom.window.close();
});
