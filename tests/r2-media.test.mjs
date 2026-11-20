import test from 'node:test';import assert from 'node:assert/strict';import {allowedMediaPath,makeMediaHandler,mediaSigner} from '../lib/r2-media.mjs';
const env={R2_MEDIA_ENABLED:'true',SUPABASE_URL:'https://auth.example',SUPABASE_PUBLISHABLE_KEY:'public-test'};
async function call(handler,{method='POST',token='test-session',body={paths:['M01/M01.mp4']}}={}){const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.body=data;return this;}};await handler({method,headers:token?{authorization:'Bearer '+token}:{},body},res);return res;}
test('media signing only accepts published lesson and course path shapes',()=>{
 for(const key of ['M01/M01.mp4','M17/M17_blitz.vtt','course/full/index.m3u8','course/blitz/segment-00001.m4s'])assert.ok(allowedMediaPath(key),key);
 for(const key of ['../.env.local','M01/M02.mp4','M18/M18.mp4','course/full/../../private','https://other.example/x','course/private/index.m3u8','M01/M01.mp4?token=x'])assert.ok(!allowedMediaPath(key),key);
});
test('media API denies guests and invalid sessions before producing URLs',async()=>{
 let signed=0;const handler=makeMediaHandler({env,fetcher:async()=>({status:401,ok:false}),signer:async()=>{signed++;return 'unused';}});
 assert.equal((await call(handler,{token:null})).code,401);assert.equal((await call(handler)).code,401);assert.equal(signed,0);
});
test('media API validates the authenticated user server-side and returns only temporary links',async()=>{
 let request;const handler=makeMediaHandler({env,fetcher:async(url,options)=>{request={url,options};return {ok:true,status:200,json:async()=>({id:'student'})};},signer:async path=>'https://media.example/'+path+'?temporary=1'});
 const response=await call(handler);assert.equal(response.code,200);assert.equal(response.body.data[0].path,'M01/M01.mp4');assert.equal(request.url,'https://auth.example/auth/v1/user');assert.equal(request.options.headers.Authorization,'Bearer test-session');assert.equal(response.headers['Cache-Control'],'private, no-store');
});
test('media API rejects traversal, oversized batches and wrong methods',async()=>{
 let calls=0;const handler=makeMediaHandler({env,fetcher:async()=>{calls++;}});
 assert.equal((await call(handler,{method:'GET'})).code,405);assert.equal((await call(handler,{body:{paths:['../secret']}})).code,400);assert.equal((await call(handler,{body:{paths:Array(101).fill('M01/M01.mp4')}})).code,400);assert.equal(calls,0);
});
test('media API fails closed during auth outages and before rollout',async()=>{
 const down=makeMediaHandler({env,fetcher:async()=>{throw Error('private upstream details');}});assert.equal((await call(down)).code,503);
 const disabled=makeMediaHandler({env:{...env,R2_MEDIA_ENABLED:'false'}});assert.equal((await call(disabled)).code,503);
});
test('S3 playback URLs permit only GET for six hours without exposing the secret',async()=>{
 const secret='test-only-secret-not-a-live-key';const sign=mediaSigner({R2_ENDPOINT:'https://test-account.r2.cloudflarestorage.com',R2_BUCKET_NAME:'learn-skit',R2_ACCESS_KEY_ID:'test-access',R2_SECRET_ACCESS_KEY:secret});
 const url=new URL(await sign('course/full/init.mp4'));assert.equal(url.searchParams.get('X-Amz-Expires'),'21600');assert.equal(url.searchParams.get('X-Amz-Algorithm'),'AWS4-HMAC-SHA256');assert.ok(!url.href.includes(secret));assert.ok(url.pathname.endsWith('/course/full/init.mp4'));assert.ok(url.hostname.startsWith('learn-skit.')||url.pathname.startsWith('/learn-skit/'));
 assert.throws(()=>mediaSigner({R2_ENDPOINT:'https://evil.example'}));
});
