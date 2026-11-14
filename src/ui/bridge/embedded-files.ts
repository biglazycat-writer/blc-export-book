import JSZip from 'jszip';
import {waitForTask} from 'blc-plugin-sdk';
import {getSDK} from './sdk';
import {listResources,readImageAsDataURL} from './export-api';
import type {CanvasSnapshot} from '../features/canvas/domain/types';
import type {CreativeArtifact} from '../features/creative/types';

export async function readEmbeddedBytes(path:string):Promise<Uint8Array> {
  let offset=0,version='',total=-1;
  const chunks:Uint8Array[]=[];
  for (;;) {
    const api=getSDK();
    const task=await api.commands.invoke('resource.read',{path,offset,version});
    const result=await waitForTask(api.tasks,task.id);
    const part=result.result as {data:string;offset:number;nextOffset:number;total:number;version:string};
    if(!part||part.offset!==offset||!Number.isSafeInteger(part.total)||part.total<0||part.total>32*1024*1024||(version&&(part.version!==version||part.total!==total)))throw new Error('嵌入资源读取期间发生变更');
    const bytes=Uint8Array.from(atob(part.data),char=>char.charCodeAt(0));
    if(part.nextOffset!==offset+bytes.length||part.nextOffset>part.total||(!bytes.length&&part.nextOffset!==part.total))throw new Error('嵌入资源分块不完整');
    chunks.push(bytes);offset=part.nextOffset;version=part.version;total=part.total;
    if(offset===total) {const output=new Uint8Array(total);let cursor=0;for(const chunk of chunks){output.set(chunk,cursor);cursor+=chunk.length;}return output;}
  }
}

async function zipJSON(zip:JSZip,name:string) {
  const entry=zip.file(name);
  if(!entry)return undefined;
  return JSON.parse(await entry.async('string'));
}

export function canvasFromFile(file:any):CanvasSnapshot {
  if(file.schema!=='biglazycat/canvas'||file.schema_version!==1||!file.id||!file.scene)throw new Error('画布文件缺少可渲染的场景或版本不受支持');
  const scene=file.scene;
  if(scene.schema_version!==1||!scene.settings||!Array.isArray(scene.elements)||!Array.isArray(scene.layers))throw new Error('画布场景无效');
  return {
    resource:{id:file.id,workspace_id:'',kind:'canvas',role:scene.role,title:file.title,order_key:'',revision:scene.revision,created_at:file.created_at,updated_at:file.updated_at},
    document:{id:file.id,resource_id:file.id,schema_version:scene.schema_version,revision:scene.revision,settings:scene.settings},
    elements:scene.elements,layers:scene.layers,connectors:scene.connectors||[],interactions:scene.interactions||[],
  };
}

async function openMindMapArchive(bytes:Uint8Array):Promise<JSZip> {
  const zip=await JSZip.loadAsync(bytes);
  // Bound decompression before the parser reads JSON/XML or image entries.
  const entries=Object.values(zip.files);
  if(entries.length>4096)throw new Error('思维导图压缩包条目过多');
  let expanded=0;
  for(const entry of entries){const size=(entry as unknown as {_data?:{uncompressedSize:number}})._data?.uncompressedSize||0;expanded+=size;if(size>8*1024*1024||expanded>64*1024*1024)throw new Error('思维导图解压后的内容过大');}
  return zip;
}

async function mindMapIdentity(zip:JSZip,path:string) {
  const meta=await zipJSON(zip,'biglazycat-metadata.json');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(path))),byte=>byte.toString(16).padStart(2,'0')).join('');
  const id=meta?.id||'mind_file_'+hash.slice(0,32);
  return {meta,id};
}

export async function mindMapFromBytes(bytes:Uint8Array,path:string,archive?:JSZip):Promise<CreativeArtifact> {
  const zip=archive||await openMindMapArchive(bytes);
  const {meta,id}=await mindMapIdentity(zip,path);
  const snapshot=await zipJSON(zip,'biglazycat.json');
  let content:Record<string,unknown>;
  if(snapshot) {
    if(snapshot.schema!=='1.0'||!Array.isArray(snapshot.nodes)||snapshot.nodes.length>2000||!Array.isArray(snapshot.edges))throw new Error('思维导图数据或版本无效');
    content={...snapshot.view,nodes:snapshot.nodes,edges:snapshot.edges,theme:snapshot.theme};
  } else {
    const {default:parser}=await import('simple-mind-map/src/parse/xmind.js');
    content={root:await parser.parseXmindFile(bytes)};
  }
  // Resolve stored workspace images before rendering; no private host URL fetches.
  const visit=async(value:unknown,depth=0):Promise<void>=>{
    if(depth>128)throw new Error('思维导图层级过深');
    if(!value||typeof value!=='object')return;
    const data=value as Record<string,unknown>;
    if(typeof data.image==='string'&&data.image&&!data.image.startsWith('data:')) data.image=await readImageAsDataURL(data.image);
    for(const child of Object.values(data))if(child&&typeof child==='object')await visit(child,depth+1);
  };
  await visit(content);
  return {id,workspace_rel:path,chapter_id:meta?.chapter_id||'',kind:'mindmap',title:path.split('/').pop()!.replace(/\.xmind$/i,''),content,revision:meta?.revision||1,schema_version:1,created_at:meta?.created_at||'',updated_at:meta?.updated_at||''};
}

export async function loadEmbeddedResource(kind:'flowCanvas'|'mindMapEmbed',id:string):Promise<CanvasSnapshot|CreativeArtifact> {
  const paths:string[]=[];const visited=new Set<string>();
  const walk=async(path:string)=>{
    if(visited.has(path))throw new Error('资源目录形成循环');visited.add(path);
    for(const entry of await listResources(path)) {
      if(entry.Name.startsWith('.'))continue;
      if(entry.IsDir)await walk(entry.Rel);
      else if((kind==='flowCanvas'?/\.canvas$/i:/\.xmind$/i).test(entry.Rel))paths.push(entry.Rel);
    }
  };
  await walk('');
  const problems:string[]=[];
  for(const path of paths) {
    try {
      const bytes=await readEmbeddedBytes(path);
      if(kind==='flowCanvas') {
        const file=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
        if(file.id===id)return canvasFromFile(file);
      } else {
        const archive=await openMindMapArchive(bytes);
        if((await mindMapIdentity(archive,path)).id===id)return mindMapFromBytes(bytes,path,archive);
      }
    } catch(error){problems.push(`${path}: ${error instanceof Error?error.message:String(error)}`);}
  }
  throw new Error(`找不到嵌入${kind==='flowCanvas'?'画布':'思维导图'} ${id}${problems.length?'；'+problems.join('；'):''}`);
}
