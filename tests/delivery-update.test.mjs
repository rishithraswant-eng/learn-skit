import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../sw.js',import.meta.url),'utf8');
async function activate({stores=new Map(),version='new',ready=true,urls=['https://site.example/#/s/evs'],rejectNavigation=false}={}){
 stores.set('learn-skit-shell-'+version,new Map());const handlers={},navigated=[];
 const caches={keys:async()=>[...stores.keys()],delete:async key=>stores.delete(key),open:async key=>{if(!stores.has(key))stores.set(key,new Map());const store=stores.get(key);return {match:async k=>store.get(k),put:async(k,v)=>store.set(k,v)}}};
 const self={location:{origin:'https://site.example'},registration:{scope:'https://site.example/'},clients:{claim:async()=>{},matchAll:async()=>urls.map(url=>({url,navigate:async target=>{if(rejectNavigation)throw Error('closed tab');navigated.push(target);}}))},addEventListener:(event,callback)=>handlers[event]=callback};
 vm.runInNewContext(source.replace('__BUILD_VERSION__',version).replace('__R2_CONTENT_ENABLED__',ready?'true':'false'),{self,caches,URL,Response});
 let promise;handlers.activate({waitUntil:value=>promise=value});await promise;return {stores,navigated};
}
test('R2 update reloads returning tabs once, while skipping OAuth callbacks',async()=>{
 const stores=new Map([['learn-skit-shell-old',new Map()]]);const first=await activate({stores,urls:['https://site.example/#/s/evs','https://site.example/?code=single-use','https://site.example/?error=cancelled']});
 assert.deepEqual(first.navigated,['https://site.example/#/s/evs']);
 const next=await activate({stores,version:'next'});assert.equal(next.navigated.length,0);
});
test('fresh visitors and incomplete R2 rollouts are not forcibly reloaded',async()=>{
 assert.equal((await activate()).navigated.length,0);
 assert.equal((await activate({stores:new Map([['learn-skit-shell-old',new Map()]]),ready:false})).navigated.length,0);
});
test('a closed browser tab does not break service-worker activation',async()=>{
 await activate({stores:new Map([['learn-skit-shell-old',new Map()]]),rejectNavigation:true});
});
