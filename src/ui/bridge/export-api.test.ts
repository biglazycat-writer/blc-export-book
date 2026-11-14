import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {configureSDK} from './sdk';
import {readResource,readImageAsDataURL,loadWorkExportManuscript} from './export-api';
import {captureArticle} from '../../article-source';
import type {ResourceEntry} from 'blc-plugin-sdk';
const session={context:{workspaceId:'w',workspaceSession:'s',documentId:'draft',editorId:'editor',resource:'文章.md'}};
function setup(api:Record<string,unknown>){configureSDK(api as never,session as never);}
describe('SDK export source',()=>{
 it('loads nested folders with host Unix nanosecond timestamps and tolerates unavailable dates',async()=>{
  const date='2026-11-14T04:30:00.000Z';
  const entry=(Rel:string,ModTimeUnix?:number,IsDir=false)=>({Rel,Name:Rel.split('/').pop(),IsDir,ModTimeUnix}) as ResourceEntry;
  const entries:Record<string,ResourceEntry[]>={
   '作品':[entry('作品/第一章.md',Date.parse(date)*1_000_000),entry('作品/卷一',0,true)],
   '作品/卷一':[entry('作品/卷一/第二章.md'),entry('作品/卷一/第三章.txt',0),entry('作品/卷一/第四章.md',NaN),entry('作品/卷一/第五章.md',Infinity),entry('作品/卷一/第六章.md',Number.MAX_VALUE)],
  };
  const resources=vi.fn(async({path})=>({items:entries[path],total:entries[path].length,nextOffset:entries[path].length}));
  const read=vi.fn(async()=>({content:'正文',offset:0,nextOffset:6,totalBytes:6,hash:'h'}));
  setup({workspace:{resources,read}});
  const manuscript=await loadWorkExportManuscript('w',{type:'all',folder_path:'作品'});
  expect(manuscript.chapters).toHaveLength(6);
  expect(manuscript.chapters[0]).toMatchObject({id:'作品/第一章.md',created_at:date,updated_at:date,volume_path:''});
  expect(manuscript.chapters.slice(1).every(chapter=>chapter.updated_at===''&&chapter.volume_path==='卷一')).toBe(true);
  expect(manuscript.volumes).toEqual([expect.objectContaining({path:'卷一',chapter_count:5})]);
  expect(resources.mock.calls.map(([args])=>args.path)).toEqual(['作品','作品/卷一']);
 });
 it('reads UTF-8 byte offsets and rejects a changed resource hash',async()=>{
  const read=vi.fn().mockResolvedValueOnce({offset:0,nextOffset:3,totalBytes:6,hash:'a',content:'中'}).mockResolvedValueOnce({offset:3,nextOffset:6,totalBytes:6,hash:'a',content:'文'});
  setup({workspace:{read}});expect(await readResource('a.md')).toBe('中文');expect(read.mock.calls[1][0].offset).toBe(3);
  read.mockResolvedValueOnce({offset:0,nextOffset:3,totalBytes:6,hash:'a',content:'中'}).mockResolvedValueOnce({offset:3,nextOffset:6,totalBytes:6,hash:'b',content:'文'});await expect(readResource('a.md')).rejects.toThrow('变更');
 });
 it('rejects stalled image transfer instead of hanging',async()=>{
  setup({images:{read:async()=>({chunk:'',hash:'a',total:3})}});await expect(readImageAsDataURL('x')).rejects.toThrow('进展');
 });
 it('reads the captured unsaved draft after the editor closes and across page reloads',async()=>{
  const text='# 草稿\n\n未保存内容😀'.repeat(3000);const bytes=new TextEncoder().encode(text).length;
  const exp=vi.fn().mockResolvedValue({exportId:'x',format:'markdown',formatVersion:1,chunk:text,offset:0,nextOffset:bytes,totalBytes:bytes,hash:createHash('sha256').update(text).digest('hex'),revision:'1',draftHash:'d',dirty:true});
  const values=new Map();const storage={get:vi.fn(async(key,workspace)=>values.get(`${workspace}:${key}`)??null),set:vi.fn(async(key,value,workspace)=>{values.set(`${workspace}:${key}`,value);})};
  const source=await captureArticle({documents:{export:exp},storage} as never,{...session.context,signal:new AbortController().signal} as never);
  const view={...session,state:{mode:'article',articleSource:source}};
  exp.mockRejectedValue(new Error('EDITOR_UNAVAILABLE'));
  configureSDK({documents:{export:exp},storage} as never,view as never);
  const manuscript=await loadWorkExportManuscript('w',{type:'chapters',chapter_ids:['draft']});
  expect(manuscript.chapters[0].content).toBe(text);expect(manuscript.chapters[0].title).toBe('文章');expect(exp.mock.calls[0][0]).toMatchObject({workspaceId:'w',workspaceSession:'s',documentId:'draft',editorId:'editor'});
  configureSDK({documents:{export:exp},storage} as never,JSON.parse(JSON.stringify(view)));
  expect((await loadWorkExportManuscript('w',{type:'chapters',chapter_ids:['draft']})).chapters[0].content).toBe(text);
  expect(exp).toHaveBeenCalledTimes(1);
  values.set(`w:${source.key}-0`,'corrupt');
  await expect(loadWorkExportManuscript('w',{type:'chapters',chapter_ids:['draft']})).rejects.toThrow('校验失败');
  expect(exp).toHaveBeenCalledTimes(1);
 });
 it('does not reuse an old editor target when selecting saved articles in book mode',async()=>{
  const text='已保存的文章';const length=new TextEncoder().encode(text).length;
  const read=vi.fn().mockResolvedValue({content:text,offset:0,nextOffset:length,totalBytes:length,hash:'h'}),exp=vi.fn();
  configureSDK({documents:{export:exp},workspace:{read}} as never,{...session,state:{mode:'book'}} as never);
  expect((await loadWorkExportManuscript('w',{type:'chapters',chapter_ids:['draft']})).chapters[0].content).toBe(text);
  expect(exp).not.toHaveBeenCalled();
 });
});
