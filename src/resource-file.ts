import type {Invocation, PluginContext} from 'blc-plugin-sdk';
import {open, realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isAbsolute, relative, resolve, sep} from 'node:path';

/** Binary resource access scoped to the invoking page's frozen workspace. */
export async function readEmbeddedFile(ctx:PluginContext,args:{path:string;offset?:number;version?:string},inv:Invocation) {
  inv.signal.throwIfAborted();
  if (!inv.workspaceId || !inv.workspaceSession) throw new Error('缺少工作区会话');
  const target={workspaceId:inv.workspaceId,workspaceSession:inv.workspaceSession};
  const validate=()=>ctx.workspace.resources({...target,path:'',limit:1});
  await validate();
  const record=(await ctx.workspace.list()).find(item=>item.id===inv.workspaceId);
  if (!record) throw new Error('工作区已关闭');
  const path=String(args.path||'').replaceAll('\\','/');
  if (!/\.(canvas|xmind)$/i.test(path)||isAbsolute(path)||path.split('/').some(part=>!part||part==='..'||part==='.'||part.includes(':'))) throw new Error('嵌入资源路径无效');
  const root=await realpath(record.rootPath);
  const filePath=await realpath(resolve(root,path));
  const rel=relative(root,filePath);
  if (!rel||isAbsolute(rel)||rel==='..'||rel.startsWith('..'+sep)) throw new Error('嵌入资源不在工作区内');
  const offset=args.offset??0;
  if (!Number.isSafeInteger(offset)||offset<0) throw new Error('读取偏移无效');
  const file=await open(filePath,'r');
  try {
    const before=await file.stat();
    if (!before.isFile()||before.size>32*1024*1024||offset>before.size) throw new Error('嵌入资源大小无效或超过 32 MiB');
    const version=createHash('sha256').update([before.dev,before.ino,before.size,before.mtimeMs,before.ctimeMs].join(':')).digest('hex');
    if (args.version&&args.version!==version) throw new Error('嵌入资源读取期间发生变更，请重新导出');
    const bytes=Buffer.alloc(Math.min(192*1024,before.size-offset));
    let read=0;
    while(read<bytes.length) {const part=await file.read(bytes,read,bytes.length-read,offset+read);if(!part.bytesRead)throw new Error('嵌入资源读取不完整');read+=part.bytesRead;}
    const after=await file.stat();
    if (before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs) throw new Error('嵌入资源读取期间发生变更');
    inv.signal.throwIfAborted();
    await validate();
    return {data:bytes.toString('base64'),offset,nextOffset:offset+read,total:before.size,version};
  } finally {await file.close();}
}
