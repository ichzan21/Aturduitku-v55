import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const vercel = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
for (const namespace of ['auth','firebase']) {
  const source=`/__/${namespace}/:path*`;
  const index=vercel.rewrites.findIndex(rule=>rule.source===source);
  assert.ok(index>=0&&index<vercel.rewrites.length-1,'Firebase helpers must precede the SPA fallback');
  assert.equal(vercel.rewrites[index].destination,`https://aturduitku.firebaseapp.com/__/${namespace}/:path*`);
}
const listeners = {};
const sw = await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
runInNewContext(sw,{URL,self:{location:{origin:'https://www.aturduitku.com'},addEventListener:(event,cb)=>{listeners[event]=cb;}}});
for (const path of ['/__/auth/handler?eventId=one','/__/auth/iframe?apiKey=one','/__/auth/iframe.js','/__/firebase/init.json','/api/users/data']) {
  for (const mode of ['navigate','cors','no-cors']) {
    let intercepted=false;
    listeners.fetch({request:{url:`https://www.aturduitku.com${path}`,method:'GET',mode},respondWith:()=>{intercepted=true;}});
    assert.equal(intercepted,false,`${path} (${mode}) must not read/write the offline shell or auth cache`);
  }
}
console.log('Firebase auth proxy and PWA cache isolation tests passed');
