import {describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {configureSDK} from './sdk';
import {readResource,readImageAsDataURL,loadWorkExportManuscript} from './export-api';
const session={context:{workspaceId:'w',workspaceSession:'s',documentId:'draft',editorId:'editor',resource:'文章.md'}};
function setup(api:Record<string,unknown>){configureSDK(api as never,session as never);}
describe('SDK export source',()=>{
 it('reads UTF-8 byte offsets and rejects a changed resource hash',async()=>{
  const read=vi.fn().mockResolvedValueOnce({offset:0,nextOffset:3,totalBytes:6,hash:'a',content:'中'}).mockResolvedValueOnce({offset:3,nextOffset:6,totalBytes:6,hash:'a',content:'文'});
  setup({workspace:{read}});expect(await readResource('a.md')).toBe('中文');expect(read.mock.calls[1][0].offset).toBe(3);
  read.mockResolvedValueOnce({offset:0,nextOffset:3,totalBytes:6,hash:'a',content:'中'}).mockResolvedValueOnce({offset:3,nextOffset:6,totalBytes:6,hash:'b',content:'文'});await expect(readResource('a.md')).rejects.toThrow('变更');
 });
 it('rejects stalled image transfer instead of hanging',async()=>{
  setup({images:{read:async()=>({chunk:'',hash:'a',total:3})}});await expect(readImageAsDataURL('x')).rejects.toThrow('进展');
 });
 it('uses live markdown export for the current article, including unsaved drafts',async()=>{
  const text='# 草稿\n\n未保存内容';const bytes=new TextEncoder().encode(text).length;
  const exp=vi.fn().mockResolvedValue({exportId:'x',format:'markdown',formatVersion:1,chunk:text,offset:0,nextOffset:bytes,totalBytes:bytes,hash:createHash('sha256').update(text).digest('hex'),revision:'1',draftHash:'d',dirty:true});
  setup({documents:{export:exp}});
  const manuscript=await loadWorkExportManuscript('w',{type:'chapters',chapter_ids:['draft']});
  expect(manuscript.chapters[0].content).toBe(text);expect(manuscript.chapters[0].title).toBe('文章');expect(exp.mock.calls[0][0]).toMatchObject({workspaceId:'w',workspaceSession:'s',documentId:'draft',editorId:'editor'});
 });
});
