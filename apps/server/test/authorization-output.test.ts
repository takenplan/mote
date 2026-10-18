import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizationOutput} from '../src/connectors/authorization-output.js';

test('DWS split stderr preserves the full opaque URL before the manual-code URL and ignores provider prose',()=>{const links:string[]=[],read=authorizationOutput('dingtalk',url=>links.push(url)),complete='https://login.dingtalk.com/oauth2/auth?user_code=a%2Bb&state=opaque%2Fvalue';for(const chunk of ['generated provider output\nhttps://evil.invalid/a\nhttps://login.ding','talk.com/oauth2/auth?user_code=a%2Bb&state=opaque%2Fvalue\r','\nmanual code URL\nhttps://login.dingtalk.com/oauth2/auth\n'])read(chunk);assert.deepEqual(links,[complete]);});
test('authorization output rejects credentials, ports, wrong domains and embedded URLs',()=>{const links:string[]=[],read=authorizationOutput('lark',url=>links.push(url));read('https://secret@accounts.feishu.cn/auth\nhttps://accounts.feishu.cn:444/auth\nhttps://feishu.cn.evil.invalid/auth\nOpen https://accounts.feishu.cn/auth\nhttps://accounts.feishu.cn/auth?code=generated\n');assert.deepEqual(links,['https://accounts.feishu.cn/auth?code=generated']);});
