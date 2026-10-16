import test from 'node:test';
import assert from 'node:assert/strict';
import React,{Suspense} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import '../src/features/runtime.js';
import {pages} from '../src/features/ask.js';
import {createApi,type WebConnection} from '../src/api.js';
import type {PageProps} from '../src/features/types.js';
const connection:WebConnection={mode:'web',origin:'https://fixture.invalid',deploymentId:'generated-deployment',userId:'a',credentialId:'generated-session',csrfToken:'generated-csrf',username:'generated-a',administrator:false};
test('existing Ask page renders for a scoped Web session without retired global status',()=>{
 const props={api:createApi(connection),status:null,devices:[],insights:[],onPage:()=>{},onOpen:()=>{}} as unknown as PageProps;
 const html=renderToStaticMarkup(React.createElement(Suspense,{fallback:'loading'},pages[0].render(props)));
 assert.match(html,/你只管问/);assert.match(html,/打开模型设置/);
});
