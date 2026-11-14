import { definePlugin, type Invocation } from 'blc-plugin-sdk';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm, type FileHandle } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { readEmbeddedFile } from './resource-file.js';

type Transfer={file:FileHandle;temp:string;path:string;size:number;written:number;owner:string;hash:ReturnType<typeof createHash>;busy:boolean;expires:number};
export default definePlugin(async ctx=>{
  ctx.commands.register('resource.read',(args,inv)=>readEmbeddedFile(ctx,args,inv));
  const transfers=new Map<string,Transfer>();
  async function discard(id:string) { const entry=transfers.get(id); if (!entry) return;transfers.delete(id);await entry.file.close().catch(()=>{});await rm(entry.temp,{force:true}).catch(()=>{}); }
  const timer=setInterval(()=>{for(const [id,entry] of transfers)if(!entry.busy&&entry.expires<Date.now())void discard(id);},30_000);
  timer.unref();
  function acquire(id:string,inv:Invocation) { const entry=transfers.get(id); if(!entry||entry.owner!==(inv.sessionId||inv.windowId||''))throw new Error('导出传输已过期');if(entry.busy)throw new Error('请按顺序传输文件');entry.busy=true;entry.expires=Date.now()+120_000;return entry; }
  for(const mode of ['article','book']) ctx.commands.register(`export.${mode}`,async (_args:unknown,inv:Invocation)=>{
    inv.signal.throwIfAborted();
    if(mode==='article'&&(!inv.documentId||!inv.editorId))throw new Error('请从文章编辑器打开排版导出');
    return ctx.views.open('main',{context:inv,state:{mode}});
  });
  ctx.commands.register('save.begin',async (args:{filename:string;size:number},inv:Invocation)=>{
    inv.signal.throwIfAborted();
    if(!Number.isSafeInteger(args.size)||args.size<1||args.size>1024*1024*1024)throw new Error('导出文件大小无效或超过 1 GiB');
    const extension=extname(String(args.filename)).toLowerCase();
    if(!['.pdf','.docx','.epub','.html','.png'].includes(extension))throw new Error('不支持的导出格式');
    if(transfers.size>=4)throw new Error('请等待其他导出完成');
    const selected=await ctx.ui.saveFile({filename:args.filename});
    if(!selected)return {cancelled:true};
    inv.signal.throwIfAborted();
    const path=extname(selected)?selected:selected+extension;
    const id=randomUUID();const temp=join(dirname(path),`.blc-export-${id}.tmp`);
    await mkdir(dirname(path),{recursive:true});
    const file=await open(temp,'wx');
    transfers.set(id,{file,temp,path,size:args.size,written:0,owner:inv.sessionId||inv.windowId||'',hash:createHash('sha256'),busy:false,expires:Date.now()+120_000});
    return {id,cancelled:false};
  });
  ctx.commands.register('save.chunk',async(args:{id:string;offset:number;data:string},inv:Invocation)=>{
    inv.signal.throwIfAborted();const entry=acquire(args.id,inv);
    try {
      if(args.offset!==entry.written)throw new Error('导出分块顺序不正确');
      if(typeof args.data!=='string'||args.data.length>256*1024||!args.data||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(args.data))throw new Error('导出分块无效');
      const bytes=Buffer.from(args.data,'base64');
      if(entry.written+bytes.length>entry.size)throw new Error('导出数据超过声明大小');
      let offset=0;
      while(offset<bytes.length) { const result=await entry.file.write(bytes,offset,bytes.length-offset,entry.written+offset); if(result.bytesWritten===0)throw new Error('文件写入没有进展');offset+=result.bytesWritten; }
      entry.hash.update(bytes);entry.written+=bytes.length;return {offset:entry.written};
    } finally {entry.busy=false;}
  });
  ctx.commands.register('save.finish',async(args:{id:string},inv:Invocation)=>{
    inv.signal.throwIfAborted();const entry=acquire(args.id,inv);
    try {
      if(entry.written!==entry.size)throw new Error('导出文件尚未传输完整');
      await entry.file.sync();await entry.file.close();await rename(entry.temp,entry.path);transfers.delete(args.id);
      return {path:entry.path,size:entry.written,sha256:entry.hash.digest('hex'),cancelled:false};
    } catch(error){await discard(args.id);throw error;} finally{entry.busy=false;}
  });
  ctx.commands.register('save.abort',async(args:{id:string},inv:Invocation)=>{acquire(args.id,inv);await discard(args.id);return {cancelled:true};});
  return async()=>{clearInterval(timer);await Promise.all([...transfers.keys()].map(discard));};
});
