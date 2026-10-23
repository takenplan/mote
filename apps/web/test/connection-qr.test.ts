import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import QRCode from 'qrcode';
import {connectionUri} from '@mote/shared';
import {connectionQrDataUrl} from '../src/connection-qr.js';

test('the actual connection QR renderer emits scannable dark modules with a white quiet zone',async()=>{
    const uri=connectionUri({format:'mote.connection',version:1,serverUrl:'https://generated.invalid',code:'A'.repeat(43),expiresAt:new Date(Date.now()+600000).toISOString()});
    const url=await connectionQrDataUrl(uri);
    assert.ok(url.startsWith('data:image/png;base64,'));
    const {data,info}=await sharp(Buffer.from(url.split(',')[1]!,'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,360);assert.equal(info.height,360);
    const pixel=(x:number,y:number)=>Array.from(data.subarray((y*info.width+x)*info.channels,(y*info.width+x)*info.channels+4));
    for(const [x,y] of [[0,0],[359,0],[0,359],[359,359]])assert.deepEqual(pixel(x!,y!),[255,255,255,255]);
    const matrix=QRCode.create(uri,{errorCorrectionLevel:'M'}).modules;
    const scale=360/(matrix.size+8);
    for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++){
        const expected=matrix.get(y,x)?[0,0,0,255]:[255,255,255,255];
        assert.deepEqual(pixel(Math.floor((x+4.5)*scale),Math.floor((y+4.5)*scale)),expected,`module ${x},${y}`);
    }
});
