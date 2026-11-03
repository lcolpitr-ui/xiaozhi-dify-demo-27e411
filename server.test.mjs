import test from 'node:test';import assert from 'node:assert/strict';import {createServer,cleanAnswer} from './server.mjs';
test('removes complete and incomplete reasoning blocks',()=>{assert.equal(cleanAnswer('<think>private</think>你好'),'你好');assert.equal(cleanAnswer('你好<think>unfinished'),'你好');});
test('proxy protects credentials, separates sessions and preserves a follow-up',async t=>{
 const calls=[];const server=createServer({key:'test-secret-only',upstreamFetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);assert.equal(options.headers.Authorization,'Bearer test-secret-only');return Response.json({answer:'<think>internal</think>正常答案',conversation_id:'conversation-one',other:'hidden'});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const post=(data,headers={})=>fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 assert.equal((await post({query:'你好'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await post({query:''})).status,400);
 const first=await post({query:'退货流程'});const cookie=first.headers.get('set-cookie').split(';')[0];const result=await first.json();assert.deepEqual(result,{answer:'正常答案',conversation_id:'conversation-one'});
 assert.equal((await post({query:'那运费呢',conversation_id:'conversation-one'},{Cookie:cookie})).status,200);assert.equal(calls[0].user,calls[1].user);assert.equal(calls[1].conversation_id,'conversation-one');
 assert.equal((await post({query:'窃取会话',conversation_id:'conversation-one'})).status,409);
 const source=await (await fetch(base+'/')).text();assert(!source.includes('test-secret-only'));assert.equal((await fetch(base+'/.env')).status,404);assert.equal((await fetch(base+'/console/api')).status,404);
});
test('upstream failures do not reveal provider details',async t=>{const server=createServer({key:'secret',upstreamFetch:async()=>new Response('private-provider-info',{status:401})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/chat',{method:'POST',body:JSON.stringify({query:'测试'})});assert.equal(r.status,502);assert(!(await r.text()).includes('private-provider-info'));});
