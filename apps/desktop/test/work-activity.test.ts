import {afterEach,expect,it,vi} from 'vitest';
import {centralWorkActivity} from '../src/work-activity';
import {defaultConfig} from '../src/config';
afterEach(()=>vi.unstubAllGlobals());
const config={...defaultConfig(),serverUrl:'http://127.0.0.1:9999',token:'generated-token',authSignedOut:false};
it('reads bounded owner work from the fixed current-node endpoint and preserves pagination',async()=>{
  const fetch=vi.fn(async()=>new Response(JSON.stringify({items:[],nextCursor:20})));vi.stubGlobal('fetch',fetch);
  expect(await centralWorkActivity(config,{state:'attention',cursor:10})).toEqual({items:[],nextCursor:20});
  const [url,options]=fetch.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('http://127.0.0.1:9999/api/work-activity?state=attention&limit=10&cursor=10');
  expect((options.headers as Record<string,string>).Authorization).toBe('Bearer generated-token');expect(options.redirect).toBe('error');
});
it('rejects authority-changing parameters before transport and treats permission denial as a failed read',async()=>{
  const fetch=vi.fn(async()=>new Response('{}',{status:403}));vi.stubGlobal('fetch',fetch);
  for(const query of [{cursor:-1},{state:'arbitrary'},{path:'/api/configuration'}])await expect(centralWorkActivity(config,query as never)).rejects.toThrow('Invalid work activity query');
  expect(fetch).not.toHaveBeenCalled();await expect(centralWorkActivity(config)).rejects.toThrow();expect(fetch).toHaveBeenCalledOnce();
});
