import { getSDK, workspaceTarget } from './sdk';
import { mergeWorkExportSettings } from '../features/novels/work-export/settings';
import { createDefaultWorkExportSettings, type WorkExportDefaultsInput } from '../features/novels/work-export/presets';
import type { WorkExportSettings, WorkExportSettingsPatch } from '../features/novels/work-export/types';
type Manifest={version:1;generation:string;parts:number;hash:string};
const queues=new Map<string,Promise<void>>();
async function hash(text:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
async function keyFor(scope:string){return 'layout-'+(await hash(scope)).slice(0,32);}
function manifest(value:unknown):Manifest|null {
  const v=value as Manifest|null;
  return v?.version===1&&/^[a-f0-9-]{36}$/.test(v.generation)&&Number.isSafeInteger(v.parts)&&v.parts>0&&v.parts<=8192&&/^[a-f0-9]{64}$/.test(v.hash)?v:null;
}
async function read(scope:string):Promise<WorkExportSettingsPatch|null>{
  const sdk=getSDK(),{workspaceId}=workspaceTarget(),key=await keyFor(scope);
  // A writer may replace the manifest while the old chunks are being read.
  for(let attempt=0;attempt<2;attempt++){
    const stored=await sdk.storage.get(key,workspaceId);
    if(stored===null)return null;
    const head=manifest(stored);if(!head)throw new Error('排版设置索引损坏');
    const chunks:string[]=[];
    for(let index=0;index<head.parts;index++) {const part=await sdk.storage.get(`${key}-${head.generation}-${index}`,workspaceId);if(typeof part!=='string')break;chunks.push(part);}
    const text=chunks.join('');
    if(chunks.length===head.parts&&await hash(text)===head.hash)return JSON.parse(text) as WorkExportSettingsPatch;
  }
  throw new Error('排版设置读取期间发生变更，请重新加载');
}
export async function loadPersistedSettings(scope:string,defaults:WorkExportDefaultsInput):Promise<WorkExportSettings>{
  const settings=await read(scope);
  const author=await getSDK().storage.get('last-author',workspaceTarget().workspaceId);
  return mergeWorkExportSettings(settings||undefined,createDefaultWorkExportSettings({...defaults,author:typeof author==='string'?author:defaults.author}));
}
export function savePersistedSettings(scope:string,settings:WorkExportSettings):Promise<void>{
  const snapshot=JSON.stringify(settings);
  const next=(queues.get(scope)||Promise.resolve()).catch(()=>{}).then(async()=>{
    const sdk=getSDK(),{workspaceId}=workspaceTarget(),key=await keyFor(scope);
    const previous=manifest(await sdk.storage.get(key,workspaceId));const digest=await hash(snapshot);
    if(previous?.hash===digest)return;
    const generation=crypto.randomUUID(),parts=Math.ceil(snapshot.length/8192);
    if(parts>8192)throw new Error('排版设置过大');
    for(let index=0;index<parts;index++)await sdk.storage.set(`${key}-${generation}-${index}`,snapshot.slice(index*8192,(index+1)*8192),workspaceId);
    await sdk.storage.set(key,{version:1,generation,parts,hash:digest},workspaceId);
    await sdk.storage.set('last-author',settings.common.author,workspaceId);
    // Null tombstones release old image data; readers retry the current manifest.
    if(previous)for(let index=0;index<previous.parts;index++)await sdk.storage.set(`${key}-${previous.generation}-${index}`,null,workspaceId);
  });
  queues.set(scope,next);return next;
}
