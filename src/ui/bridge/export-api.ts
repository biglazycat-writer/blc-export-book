import { type ResourceEntry } from 'blc-plugin-sdk';
import { readArticle, type ExportState } from '../../article-source';
import { getSDK, getSession, workspaceTarget } from './sdk';
import type { WorkExportChapter, WorkExportManuscript, WorkExportScope } from '../types/models';
import {resolveSourceImages,sourceWordCount} from './source-images';

export async function listResources(path=''): Promise<ResourceEntry[]> {
  const entries: ResourceEntry[]=[];
  let offset=0;
  for (;;) {
    const page=await getSDK().workspace.resources({...workspaceTarget(),path,offset,limit:100});
    entries.push(...page.items);
    if (page.nextOffset>=page.total) return entries;
    if (page.nextOffset<=offset) throw new Error('资源列表没有返回下一页');
    offset=page.nextOffset;
  }
}

export async function readResource(path:string): Promise<string> {
  let offset=0,hash='',total=-1;
  const chunks:string[]=[];
  for (;;) {
    const part=await getSDK().workspace.read({...workspaceTarget(),path,offset,limit:96*1024});
    if (part.offset!==offset || (hash && (hash!==part.hash || total!==part.totalBytes))) throw new Error('文稿读取期间发生变更，请重新加载');
    if (new TextEncoder().encode(part.content).length!==part.nextOffset-offset) throw new Error('文稿分块长度不正确');
    hash=part.hash; total=part.totalBytes; chunks.push(part.content);
    if (part.nextOffset===total) return chunks.join('');
    if (part.nextOffset<=offset || part.nextOffset>total) throw new Error('文稿读取没有进展');
    offset=part.nextOffset;
  }
}

export interface ImageLibraryItem {id:string;name:string;src:string;width:number;height:number}

export async function listImageAssets(query='',offset=0,limit=24):Promise<{items:ImageLibraryItem[];total:number}> {
  return getSDK().images.list({...workspaceTarget(),query,offset,limit});
}

export async function readImageAsDataURL(src:string):Promise<string> {
  if (/^data:image\//i.test(src)) return src;
  let result='',hash='',total=-1;
  for (;;) {
    const part=await getSDK().images.read({...workspaceTarget(),src,offset:result.length,limit:256*1024,hash});
    if (hash && (hash!==part.hash || total!==part.total)) throw new Error('图片读取期间发生变更');
    hash=part.hash;total=part.total;
    if (!part.chunk && result.length<total) throw new Error('图片读取没有进展');
    result+=part.chunk;
    if (result.length===total) return result;
    if (result.length>total) throw new Error('图片分块长度不正确');
  }
}

const basename=(path:string)=>path.replaceAll('\\','/').split('/').pop()?.replace(/\.(md|markdown|txt)$/i,'')||'未命名';
function resourceDate(nanoseconds:number):string {
  // API 1 ModTimeUnix is Unix nanoseconds, matching the host's file scan.
  if (!Number.isFinite(nanoseconds) || nanoseconds===0) return '';
  const date=new Date(nanoseconds/1_000_000);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}
function chapter(id:string,title:string,content:string,volume_path='',updated_at=''):WorkExportChapter {
  return {id,title,content,volume_path,synopsis:'',word_count:sourceWordCount(content),created_at:updated_at,updated_at};
}

export async function getChapter(id:string):Promise<WorkExportChapter> {
  const session=getSession(),ctx=session.context;
  if (id===ctx.documentId && (session.state as ExportState)?.mode==='article') {
    const source=(session.state as ExportState).articleSource;
    if(!source || source.documentId!==id)throw new Error('请从文章重新打开排版导出，以读取本次稿件');
    const content=await readArticle(getSDK().storage,source,workspaceTarget().workspaceId);
    const title=source.resource ? basename(source.resource) : content.match(/^#\s+(.+)$/m)?.[1] || basename(id);
    return chapter(id,title,resolveSourceImages(content,source.resource||id,workspaceTarget().workspaceId));
  }
  return chapter(id,basename(id),resolveSourceImages(await readResource(id),id,workspaceTarget().workspaceId));
}

export async function loadWorkExportManuscript(_id:string,scope:WorkExportScope):Promise<WorkExportManuscript> {
  const root=scope.folder_path || '';
  const result:WorkExportManuscript={novel_id:workspaceTarget().workspaceId,title:root ? basename(root) : '我的书籍',synopsis:'',workspace_kind:scope.type==='chapters'?'standalone':'writing',word_count:0,volumes:[],chapters:[]};
  if (scope.type==='chapters') {
    result.chapters=await Promise.all((scope.chapter_ids||[]).map(getChapter));
    result.title=result.chapters[0]?.title || result.title;
  } else {
    const visited=new Set<string>();
    async function walk(path:string) {
      if (visited.has(path)) throw new Error('资源目录形成循环');
      visited.add(path);
      const entries=await listResources(path);
      for (const entry of entries) {
        if (entry.Name.startsWith('.')) continue;
        const volume=path===root?'':path.slice(root ? root.length+1 : 0);
        if (entry.IsDir) {
          const rel=entry.Rel.slice(root ? root.length+1 : 0);
          result.volumes.push({path:rel,parent_path:volume,title:entry.Title||entry.Name,chapter_count:0,word_count:0});
          await walk(entry.Rel);
        } else if (/\.(md|markdown|txt)$/i.test(entry.Rel)) {
          const content=resolveSourceImages(await readResource(entry.Rel),entry.Rel,workspaceTarget().workspaceId);
          result.chapters.push(chapter(entry.Rel,entry.Title||basename(entry.Name),content,volume,resourceDate(entry.ModTimeUnix)));
        }
      }
    }
    await walk(root);
  }
  result.word_count=result.chapters.reduce((sum,c)=>sum+c.word_count,0);
  for(const volume of result.volumes) { const chapters=result.chapters.filter(c=>c.volume_path===volume.path);volume.chapter_count=chapters.length;volume.word_count=chapters.reduce((sum,c)=>sum+c.word_count,0); }
  return result;
}
export const exportApi={loadWorkExportManuscript,readImageAsDataURL,listImageAssets,getChapter};
