import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import plugin from '../dist/main.js';
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
async function harness(t) {
 const root=await mkdtemp(join(tmpdir(),'blc-export-test-'));const commands=new Map();const opened=[];
 let chosen=join(root,'导出');
 const dispose=await plugin.activate({commands:{register:(id,handler)=>commands.set(id,handler)},views:{open:async(id,options)=>{opened.push({id,options});return {viewId:id};}},ui:{saveFile:async()=>chosen}});
 t.after(async()=>{await dispose();await rm(root,{recursive:true,force:true});});
 const inv={sessionId:'session-a',windowId:'window-a',signal:new AbortController().signal};
 return {root,commands,opened,dispose,inv,choose:value=>{chosen=value;},invoke:(id,args,context=inv)=>commands.get(id)(args,context)};
}
test('manifest commands are registered and open article/book with immutable invocation',async t=>{
 const h=await harness(t);assert.deepEqual([...h.commands.keys()].sort(),manifest.biglazycat.contributes.commands.map(c=>c.id).sort());
 await assert.rejects(h.invoke('export.article',{}),/文章编辑器/);
 const inv={...h.inv,documentId:'draft',editorId:'editor'};await h.invoke('export.article',{},inv);await h.invoke('export.book',{});
 assert.equal(h.opened[0].options.context,inv);assert.deepEqual(h.opened.map(v=>v.options.state.mode),['article','book']);
});
test('streams a multi-message binary file without modifying its bytes',async t=>{
 const h=await harness(t);const bytes=Buffer.alloc(800_000);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
 const start=await h.invoke('save.begin',{filename:'测试.pdf',size:bytes.length});
 for(let offset=0;offset<bytes.length;offset+=192*1024) {
  const chunk=bytes.subarray(offset,offset+192*1024);assert.equal((await h.invoke('save.chunk',{id:start.id,offset,data:chunk.toString('base64')})).offset,offset+chunk.length);
 }
 const result=await h.invoke('save.finish',{id:start.id});assert.deepEqual(await readFile(result.path),bytes);
 assert.equal(result.path,join(h.root,'导出.pdf'));assert.equal(result.sha256,createHash('sha256').update(bytes).digest('hex'));
 assert.deepEqual(await readdir(h.root),['导出.pdf']);
});
test('cancelled save opens no file and aborted invocation opens no dialog',async t=>{
 const h=await harness(t);h.choose('');assert.deepEqual(await h.invoke('save.begin',{filename:'a.png',size:1}),{cancelled:true});
 const controller=new AbortController();controller.abort();await assert.rejects(h.invoke('save.begin',{filename:'a.png',size:1},{...h.inv,signal:controller.signal}),{name:'AbortError'});assert.deepEqual(await readdir(h.root),[]);
});
test('rejects out-of-order, corrupt, oversized, cross-session and incomplete transfers',async t=>{
 const h=await harness(t);const {id}=await h.invoke('save.begin',{filename:'a.epub',size:4});
 await assert.rejects(h.invoke('save.chunk',{id,offset:1,data:'YWJjZA=='}),/顺序/);
 await assert.rejects(h.invoke('save.chunk',{id,offset:0,data:'!!!'}),/无效/);
 await assert.rejects(h.invoke('save.chunk',{id,offset:0,data:Buffer.alloc(5).toString('base64')}),/超过/);
 await assert.rejects(h.invoke('save.abort',{id},{...h.inv,sessionId:'other'}),/过期/);
 await assert.rejects(h.invoke('save.finish',{id}),/完整/);assert.deepEqual(await readdir(h.root),[]);
});
test('failed or cancelled transfer preserves an existing user file',async t=>{
 const h=await harness(t);const path=join(h.root,'existing.docx');h.choose(path);await writeFile(path,'original');
 const {id}=await h.invoke('save.begin',{filename:'a.docx',size:3});await h.invoke('save.chunk',{id,offset:0,data:'YWJj'});await h.invoke('save.abort',{id});assert.equal(await readFile(path,'utf8'),'original');
});

test('reads binary embedded files in bounded chunks and refuses changed files or workspace sessions',async t=>{
 const root=await mkdtemp(join(tmpdir(),'blc-resource-test-'));const commands=new Map();let valid=true,checks=0;
 const dispose=await plugin.activate({commands:{register:(id,handler)=>commands.set(id,handler)},workspace:{list:async()=>[{id:'workspace',rootPath:root}],resources:async args=>{checks++;if(!valid||args.workspaceSession!=='frozen')throw new Error('workspace stale');return {items:[],total:0,nextOffset:0};}}});
 t.after(async()=>{await dispose();await rm(root,{recursive:true,force:true});});
 const inv={workspaceId:'workspace',workspaceSession:'frozen',signal:new AbortController().signal};
 const read=(args,context=inv)=>commands.get('resource.read')(args,context);
 const bytes=Buffer.alloc(400000);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
 await writeFile(join(root,'diagram.xmind'),bytes);
 const first=await read({path:'diagram.xmind'});assert.equal(first.nextOffset,192*1024);assert.equal(first.total,bytes.length);assert.deepEqual(Buffer.from(first.data,'base64'),bytes.subarray(0,first.nextOffset));
 const second=await read({path:'diagram.xmind',offset:first.nextOffset,version:first.version});assert.deepEqual(Buffer.from(second.data,'base64'),bytes.subarray(first.nextOffset,second.nextOffset));assert.equal(checks,4);
 await writeFile(join(root,'diagram.xmind'),'changed');await assert.rejects(read({path:'diagram.xmind',version:first.version}),/发生变更/);
 await assert.rejects(read({path:'../outside.xmind'}),/路径无效/);await assert.rejects(read({path:'secret.txt'}),/路径无效/);
 await assert.rejects(read({path:'diagram.xmind',offset:-1}),/偏移无效/);
 await assert.rejects(read({path:'diagram.xmind'},{...inv,workspaceSession:'other'}),/stale/);
 valid=false;await assert.rejects(read({path:'diagram.xmind'}),/stale/);
});
