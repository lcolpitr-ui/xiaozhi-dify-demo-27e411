import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const cleanAnswer = text => String(text ?? '').replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, '').replace(/<think\b[\s\S]*$/gi, '').trim();
export function createServer({base=process.env.DIFY_API_BASE || 'http://localhost/v1',key=process.env.DIFY_API_KEY,upstreamFetch=fetch}={}) {
  const sessions=new Map(),buckets=new Map(); let active=0;
  const assets=new Map([['/','index.html'],['/app.js','app.js'],['/style.css','style.css']]);
  const timer=setInterval(()=>{const now=Date.now();for(const [k,v] of sessions)if(now-v.updated>86400000)sessions.delete(k);for(const [k,v] of buckets)if(now-v.time>60000)buckets.delete(k);},60000);timer.unref();
  const server=http.createServer(async(req,res)=>{
    const json=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const route=new URL(req.url,'http://local').pathname;
      if(req.method==='GET'&&route==='/api/health')return json(200,{ready:Boolean(key)});
      if(req.method==='GET'&&assets.has(route)){
        const filename=assets.get(route);const data=await readFile(new URL('./public/'+filename,import.meta.url));
        res.writeHead(200,{'Content-Type':filename.endsWith('.css')?'text/css; charset=utf-8':filename.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});return res.end(data);
      }
      if(route!=='/api/chat'||req.method!=='POST')return json(404,{error:'页面不存在'});
      if(!key)return json(503,{error:'客服服务尚未配置，请联系管理员。'});
      const origin=req.headers.origin;
      if(origin&&new URL(origin).host!==req.headers.host)return json(403,{error:'不允许跨站请求'});
      const ip=req.socket.remoteAddress;const now=Date.now();const bucket=buckets.get(ip);
      if(bucket&&now-bucket.time<60000&&bucket.count>=30)return json(429,{error:'提问有些频繁，请稍后再试。'});
      buckets.set(ip,bucket&&now-bucket.time<60000?{...bucket,count:bucket.count+1}:{time:now,count:1});
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)return json(413,{error:'消息太长，请精简后再发送。'});}
      let input;try{input=JSON.parse(raw);}catch{return json(400,{error:'请求格式不正确'});}
      if(typeof input.query!=='string'||!input.query.trim()||input.query.length>1200)return json(400,{error:'请输入 1–1200 字的问题。'});
      let sid=req.headers.cookie?.match(/(?:^|;\s*)chat_session=([a-f0-9]{48})(?:;|$)/)?.[1];
      if(!sid||!sessions.has(sid)){sid=randomBytes(24).toString('hex');sessions.set(sid,{user:'web-'+randomBytes(16).toString('hex'),conversations:new Set(),updated:now});res.setHeader('Set-Cookie',`chat_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${origin?.startsWith('https:')?'; Secure':''}`);}
      const session=sessions.get(sid);session.updated=now;
      if(input.conversation_id&&!session.conversations.has(input.conversation_id))return json(409,{error:'会话已过期，请新建对话后重试。'});
      if(active>=4)return json(429,{error:'当前咨询人数较多，请稍后重试。'});
      active++;
      try{
        const upstream=await upstreamFetch(base.replace(/\/$/,'')+'/chat-messages',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({query:input.query.trim(),inputs:{},response_mode:'blocking',user:session.user,...(input.conversation_id?{conversation_id:input.conversation_id}:{})}),signal:AbortSignal.timeout(90000)});
        if(!upstream.ok)return json(502,{error:'客服服务暂时不可用，请稍后再试。'});
        const data=await upstream.json(),answer=cleanAnswer(data.answer);
        if(!answer||!data.conversation_id)return json(502,{error:'本次未获得有效回答，请重试。'});
        if(session.conversations.size>=30&&!session.conversations.has(data.conversation_id))session.conversations.delete(session.conversations.values().next().value);
        session.conversations.add(data.conversation_id);
        return json(200,{answer,conversation_id:data.conversation_id});
      }finally{active--;}
    }catch(error){if(!res.writableEnded)json(502,{error:error.name==='TimeoutError'?'回答等待超时，请稍后重试。':'连接暂时中断，请重试。'});}
  });server.on('close',()=>clearInterval(timer));return server;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
  const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||3210);
  createServer().listen(port,host,()=>console.log(`Customer chat: http://${host}:${port}`));
}
