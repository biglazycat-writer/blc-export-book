// Real production UI + bundled backend, driven through the public browser RPC.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,mkdtemp,stat} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import plugin from '../dist/main.js';
import JSZip from 'jszip';
import {canvasFile,mindMapArchive,embeddedMarkdown} from '../tests/fixtures/embedded.mjs';
const output=resolve('.vite/browser-check');await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(output,'profile-'));
const markdown='# 离线排版验证\n\n这是包含**粗体**和中文标点的文章，用于验证离线导出。\n\n## 公式与表格\n\n行内公式 $E=mc^2$。\n\n| 项目 | 结果 |\n| --- | --- |\n| 中文字体 | 正常 |\n| 离线加载 | 正常 |\n\n```mermaid\ngraph LR\nA[文稿] --> B[排版] --> C[导出]\n```\n\n![本地插图](./插图.svg)\n\n最后一段正文。'+embeddedMarkdown;
const fixtureRoot=join(output,'workspace');await mkdir(fixtureRoot,{recursive:true});
await writeFile(join(fixtureRoot,'导出画布.canvas'),JSON.stringify(canvasFile));await writeFile(join(fixtureRoot,'导出导图.xmind'),await mindMapArchive());
const resourceItems=['第二章.md','导出画布.canvas','导出导图.xmind'].map(name=>({Rel:name,Name:name,Title:name,IsDir:false,ModTimeUnix:1,Kind:extname(name).slice(1)}));
const resourcePage={items:resourceItems,total:resourceItems.length,nextOffset:resourceItems.length};
const imageData='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" rx="8" fill="#e0e9f5"/><circle cx="30" cy="20" r="12" fill="#496ba6"/><path d="M55 20h85" stroke="#496ba6" stroke-width="4"/></svg>').toString('base64');
const ctx={source:'editor.document',workspaceId:'workspace',workspaceSession:'workspace-session',documentId:'draft',editorId:'editor',windowId:'window',sessionId:'view',resource:'离线排版验证.md'};
const session={pluginId:'blc-export-book',viewId:'main',instanceId:'view',title:'排版导出',location:'tab',context:ctx,state:{mode:'article'},dirty:false,connected:true,colorScheme:'light'};
const commands=new Map(),tasks=new Map(),settings=new Map(),saved=[],requests=[];let seq=0;
const dispose=await plugin.activate({commands:{register:(id,handler)=>commands.set(id,handler)},workspace:{list:async()=>[{id:'workspace',rootPath:fixtureRoot}],resources:async args=>{assert.equal(args.workspaceSession,ctx.workspaceSession);return resourcePage;}},ui:{saveFile:async args=>join(output,`${++seq}-${args.filename}`)},views:{open:async()=>session}});
async function rpc(method,args){
 if(method==='view.context')return session;
 if(method==='view.ready'||method==='view.state')return null;
 if(method==='storage.get')return settings.get(args.key)??null;
 if(method==='storage.set'){assert.ok(Buffer.byteLength(JSON.stringify(args.value))<=64*1024);settings.set(args.key,args.value);return null;}
 if(method==='documents.export'){const bytes=Buffer.byteLength(markdown);return {exportId:'snapshot',format:'markdown',formatVersion:1,chunk:markdown,offset:0,nextOffset:bytes,totalBytes:bytes,hash:createHash('sha256').update(markdown).digest('hex'),revision:'1',draftHash:'draft',dirty:true};}
 if(method==='resources.image'){assert.ok(args.src.startsWith('/creation-image/workspace/'));return {chunk:imageData.slice(args.offset||0),total:imageData.length,hash:createHash('sha256').update(imageData).digest('hex')};}
 if(method==='resources.list')return resourcePage;
 if(method==='resources.read') {const text='## 书籍正文\n\n这是书籍中的一章。'+embeddedMarkdown;return {path:args.path,content:text,offset:0,nextOffset:Buffer.byteLength(text),totalBytes:Buffer.byteLength(text),hash:createHash('sha256').update(text).digest('hex'),complete:true};}
 if(method==='commands.invoke') {
  const id=String(++seq);const task={id,state:'running',hasResult:false};tasks.set(id,task);
  Promise.resolve().then(()=>commands.get(args.command)(args.args,{...ctx,signal:new AbortController().signal,progress:async()=>{}})).then(result=>{Object.assign(task,{state:'completed',hasResult:true,result});if(args.command==='save.finish')saved.push(result);}).catch(error=>Object.assign(task,{state:'failed',error:String(error.message),errorCode:'TEST_ERROR'}));
  return task;
 }
 if(method==='tasks.get')return tasks.get(args.id);
 throw new Error('Unexpected RPC '+method);
}
const prefix='/plugins/session/';
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.wasm':'application/wasm','.json':'application/json','.woff2':'font/woff2','.ttf':'font/ttf'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');requests.push(url.pathname);
 if(url.pathname===prefix+'__rpc') {let body='';for await(const chunk of req)body+=chunk;const input=JSON.parse(body);let reply;try{reply={v:1,id:input.id,result:await rpc(input.method,input.params)};}catch(error){reply={v:1,id:input.id,error:{code:'TEST_ERROR',message:error.message}};}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(reply));return;}
 if(url.pathname===prefix+'__sdk.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await readFile('tests/fixtures/host-browser.mjs'));return;}
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);res.end();return;}
 const file=resolve(url.pathname.slice(prefix.length));if(!file.startsWith(resolve('dist')+'/')&&!file.startsWith(resolve('dist')+'\\'))throw new Error('Invalid test path');
 let bytes=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
 if(extname(file)==='.html') {const config={apiVersion:1,apiRevision:3,colorScheme:session.colorScheme,endpoint:`http://127.0.0.1:${server.address().port}${prefix}__rpc`,token:'test'};bytes=Buffer.concat([Buffer.from(`<script>globalThis.__biglazycatPlugin=${JSON.stringify(config)}</script>`),bytes]);}
 res.end(bytes);
}catch(error){res.writeHead(500);res.end(String(error));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const testProcessFlags=process.env.BLC_BROWSER_SINGLE_PROCESS==='1'?['--single-process','--no-sandbox']:[];
const browser=spawn(process.env.BLC_BROWSER||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--in-process-gpu',...testProcessFlags,'--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
browser.stderr.on('data',data=>{void writeFile(join(output,'browser.log'),data,{flag:'a'});});
let socket;
try{
 const endpoint=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(new Error('Browser startup timeout')),20000);browser.on('error',reject);browser.stderr.on('data',data=>{text+=data;const match=/DevTools listening on (ws:\/\/\S+)/.exec(text);if(match){clearTimeout(timer);resolve(match[1]);}});});
 const page=await(await fetch('http://'+new URL(endpoint).host+'/json/new?about:blank',{method:'PUT'})).json();socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 let sequence=0;const pending=new Map(),errors=[],external=[];
 socket.onmessage=event=>{const value=JSON.parse(event.data);if(value.method==='Runtime.exceptionThrown')errors.push(value.params.exceptionDetails.exception?.description||value.params.exceptionDetails.text);if(value.method==='Network.requestWillBeSent'){const url=value.params.request.url;if(/^https?:/.test(url)&&!url.startsWith(`http://127.0.0.1:${server.address().port}/`))external.push(url);}const item=pending.get(value.id);if(item){pending.delete(value.id);clearTimeout(item.timer);value.error?item.reject(new Error(value.error.message)):item.resolve(value.result);}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout '+method));},30000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;
 async function until(expression,timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){if(errors.length)throw new Error(errors.join('\n'));if(await evaluate(`Boolean(${expression})`))return;await new Promise(resolve=>setTimeout(resolve,200));}throw new Error('Timed out: '+expression+'\n'+await evaluate('document.body.innerText'));}
 async function click(text){await until(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)return false;b.click();return true})()`);}
 async function save(format){
  const label=JSON.stringify('导出 '+format);
  const ready=`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${label}&&!b.disabled)`;
  await until(ready);
  const count=saved.length;await click('导出 '+format);
  const end=Date.now()+90000;
  while(Date.now()<end&&saved.length===count){if(errors.length)throw new Error(errors.join('\n'));await new Promise(resolve=>setTimeout(resolve,200));}
  assert.equal(saved.length,count+1,await evaluate('document.body.innerText'));
  console.log('Saved',saved.at(-1).path,saved.at(-1).size);
  await until(ready);
 }
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1380,height:920,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}${prefix}dist/ui/index.html`});
 await until("document.querySelector('.typesetPreviewCanvas') || document.querySelector('.typesetPreview canvas') || document.querySelector('canvas')");
 await save('PDF');
 for(const format of ['Word','HTML']){await evaluate(`(()=>{[...document.querySelectorAll('.typesetFormatOption')].find(b=>b.querySelector('strong').textContent===${JSON.stringify(format)}).click()})()`);await save(format);}
 const shot=await send('Page.captureScreenshot',{format:'png'});await writeFile(join(output,'article.png'),Buffer.from(shot.data,'base64'));
 await click('图片设计器');await until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='导出 PNG'&&!b.disabled)");
 assert.ok(await evaluate("document.querySelectorAll('.imageDesignContent img').length>=4"),'PNG must contain local image, Mermaid, canvas and mind map');
 assert.equal(await evaluate("document.querySelector('.imageDesignContent').textContent.includes('\"type\"')"),false,'PNG must not print document JSON');
 await save('PNG');
 await evaluate("window.dispatchEvent(new Event('export:home'))");
 await until("document.querySelector('.exportHome')");
 await until("!document.querySelector('.folderBar button:last-child').disabled");
 await click('将此文件夹制作成书籍');await until("document.querySelector('.typesetFormatOption')");
 await evaluate("[...document.querySelectorAll('.typesetFormatOption')].find(b=>b.querySelector('strong').textContent==='EPUB').click()");await save('EPUB');
 for(const format of ['PDF','Word']){await evaluate(`(()=>{[...document.querySelectorAll('.typesetFormatOption')].find(b=>b.querySelector('strong').textContent===${JSON.stringify(format)}).click()})()`);await save(format);}
 assert.equal(external.length,0,'Unexpected external fetches: '+external.join('\n'));
 for(const file of saved){const bytes=await readFile(file.path);const extension=extname(file.path);if(extension==='.pdf')assert.equal(bytes.subarray(0,5).toString(),'%PDF-');if(extension==='.png')assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');if(extension==='.docx'){const zip=await JSZip.loadAsync(bytes);assert.ok(zip.file('word/document.xml'));}if(extension==='.epub'){const zip=await JSZip.loadAsync(bytes);assert.equal(await zip.file('mimetype').async('string'),'application/epub+zip');}if(extension==='.html')assert.match(bytes.toString(),/最后一段正文/);}
 assert.ok(requests.some(url=>url.endsWith('typst_ts_web_compiler_bg.wasm')));assert.ok(requests.some(url=>url.endsWith('NotoSerifSC_400Regular.ttf')));
 const html=(await readFile(saved.find(item=>item.path.endsWith('.html')).path,'utf8'));
 assert.match(html,/alt="原始画布"/);assert.match(html,/alt="原始导图"/);
 await writeFile(join(output,'result.json'),JSON.stringify({saved,external,errors,requests:[...new Set(requests)]},null,2));console.log('Browser exports passed without external requests.');
}catch(error){console.error(error);process.exitCode=1;}finally{socket?.close();browser.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await dispose();}
