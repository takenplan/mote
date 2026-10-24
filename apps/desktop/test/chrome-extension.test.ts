import {describe,it,expect} from 'vitest';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../chrome-extension/extract.js',import.meta.url),'utf8').replace('export function extractVisible','function extractVisible');
function fixture(html:string,url='https://fixture.example/article'){const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 Object.defineProperties(w,{screenX:{value:0},screenY:{value:0},outerWidth:{value:900},innerWidth:{value:900},outerHeight:{value:700},innerHeight:{value:620},visualViewport:{value:{scale:1}}});Object.defineProperty(w.document,'visibilityState',{value:'visible'});w.document.hasFocus=()=>true;
 const box=(element:Element)=>{const [x,y,width,height]=(element.getAttribute('data-box')??'0,0,0,0').split(',').map(Number);return {x,y,width,height,right:x+width,bottom:y+height,left:x,top:y};};
 w.Element.prototype.getBoundingClientRect=function(){return box(this) as any;};
 w.Range.prototype.getClientRects=function(){return [box(this.startContainer.parentElement!)] as any;};
 w.document.elementFromPoint=(x:number,y:number)=>[...w.document.querySelectorAll('[data-box]')].reverse().find(e=>{const b=box(e);return x>=b.x&&x<=b.right&&y>=b.y&&y<=b.bottom;})??w.document.body;
 const style=w.getComputedStyle.bind(w);w.getComputedStyle=((e:Element,pseudo?:string)=>{if(pseudo)return {content:e.getAttribute('data-pseudo')??'none',display:'block',visibility:'visible',opacity:'1'} as any;const real=style(e);return new Proxy(real,{get(t,p){const value=Reflect.get(t,p);if(['opacity'].includes(String(p)))return value||'1';if(['filter','transform','clipPath','maskImage'].includes(String(p)))return value||'none';return value;}});}) as any;
 const run=(structured=true,masks:any[]=[])=>w.eval(`${source}\nextractVisible(${JSON.stringify({structured,masks,observedAt:'2026-10-24T00:00:00Z',observationId:'fixture-observation'})})`);
 return {w,run};}
describe('shipped isolated-world visible extraction',()=>{
 it('archives only visible leaf text and omits clipped, covered, masked, hidden and editable evidence',()=>{
 const {run}=fixture('<main><p data-box="10,10,150,20">Visible fixture</p><p data-box="10,610,150,30">Clipped fixture</p><p data-box="10,50,150,20">Covered fixture</p><p data-box="10,90,150,20">Masked fixture</p><p hidden data-box="10,130,150,20">Hidden fixture</p><div contenteditable data-box="10,170,150,20">Secret editor</div><input value="secret password"></main><aside data-box="10,50,150,20">Overlay</aside>');
 const result=run(true,[{x:10,y:170,width:150,height:20}]);expect(result.pages).toHaveLength(1);const fields=result.pages[0].objects[0].fields;expect(fields.find((f:any)=>f.name==='body').values.map((v:any)=>v.text)).toEqual(['Visible fixture']);expect(result.pages[0].status).toBe('partial');
 });
 it('omits partial and pointer-events:none occlusion that point hit testing cannot reveal',()=>{
 const {w,run}=fixture('<main><p data-box="10,10,150,20">Uncovered text</p><p data-box="10,50,150,20">Partially covered text</p><p data-box="10,90,150,20">Pointerless cover text</p></main><aside style="position:absolute;pointer-events:none" data-box="62,52,2,15"></aside><aside style="position:fixed;pointer-events:none" data-box="60,90,2,20"></aside>');
 // Browser hit-testing intentionally ignores these covers. Geometry still rejects.
 w.document.elementFromPoint=(x:number,y:number)=>[...w.document.querySelectorAll('p')].find(e=>{const b=e.getBoundingClientRect();return x>=b.x&&x<=b.right&&y>=b.y&&y<=b.bottom;})??w.document.body;
 const body=run().pages[0].objects[0].fields.find((f:any)=>f.name==='body');expect(body.values.map((v:any)=>v.text)).toEqual(['Uncovered text']);
 });
 it('omits text covered by a descendant box or generated pseudo overlay',()=>{
 const {w,run}=fixture('<main><p data-box="10,10,150,20">Safe text</p><p data-box="10,50,150,20">Descendant covered text<span style="position:absolute;pointer-events:none" data-box="62,52,2,15"></span></p><p data-box="10,90,150,20" data-pseudo="&quot;&quot;">Pseudo covered text</p></main>');
 w.document.elementFromPoint=(x:number,y:number)=>[...w.document.querySelectorAll('p')].find(e=>{const b=e.getBoundingClientRect();return x>=b.x&&x<=b.right&&y>=b.y&&y<=b.bottom;})??w.document.body;
 expect(run().pages[0].objects[0].fields.find((f:any)=>f.name==='body').values.map((v:any)=>v.text)).toEqual(['Safe text']);
 });
 it('keeps playback position separate and preserves media identity until the visible video source changes',()=>{
 const {w,run}=fixture('<main><h1 class="video-title" data-box="10,10,150,20">Generated video</h1><video data-box="10,50,300,200"></video></main>','https://www.bilibili.com/video/BVfixture');const video=w.document.querySelector('video')!;let source='https://media.fixture/video-1';Object.defineProperties(video,{duration:{value:120},currentTime:{value:10,writable:true},paused:{value:false},currentSrc:{get:()=>source}});
 const first=run(),second=run();expect(first.media.sessions[0].positionMs).toBe(10000);expect(second.media.sessions[0].sessionId).toBe(first.media.sessions[0].sessionId);expect(first.pages[0].objects[0].fields.map((f:any)=>f.name)).not.toContain('position');source='https://media.fixture/video-2';expect(run().media.sessions[0].sessionId).not.toBe(first.media.sessions[0].sessionId);w.document.querySelector('h1')!.remove();const onlyMedia=run();expect(onlyMedia.pages).toEqual([]);expect(onlyMedia.media.sessions[0].positionMs).toBe(10000);
 });
 it('keeps visible Bilibili progress out of UI pages when static fields are offscreen',()=>{
 const {w,run}=fixture('<main><h1 class="video-title" style="display:none">Offscreen title</h1><span id="progress" data-box="10,10,150,20">00:10 / 02:00</span><video data-box="10,50,300,200"></video></main>','https://www.bilibili.com/video/BVfixture');const video=w.document.querySelector('video')!;Object.defineProperties(video,{duration:{value:120},currentTime:{value:10,writable:true},paused:{value:false}});const first=run();expect(first.pages).toEqual([]);video.currentTime=11;w.document.querySelector('#progress')!.textContent='00:11 / 02:00';const second=run();expect(second.pages).toEqual([]);expect(second.media.sessions[0].positionMs).toBe(11000);expect(second.media.sessions[0].sessionId).toBe(first.media.sessions[0].sessionId);
 });
 it('does not attribute another visible Zhihu answer to the URL target',()=>{
 const {run}=fixture('<div class="AnswerItem" data-answer-id="999" data-box="0,0,600,500"><div class="AuthorInfo-name" data-box="10,10,150,20">Another author</div><div class="RichContent-inner" data-box="10,50,150,20">Another answer body</div></div>','https://www.zhihu.com/question/123/answer/456');expect(run().pages).toEqual([]);
 });
 it('identity-only requests cannot touch the document or page text',()=>{const {w}=fixture('<main>Private fixture</main>');const result=w.eval(`(function(document){${source};return extractVisible({structured:false});})(new Proxy({}, {get(){throw Error('DOM accessed during identity-only request');}}))`);expect(result.identity.url).toBe('https://fixture.example/article');expect(result.pages).toBeUndefined();});
});
