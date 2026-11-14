import { useEffect, useState } from 'react';
import { TypesetPage } from './features/typeset/TypesetPage';
import { getSession, workspaceTarget } from './bridge/sdk';
import { listResources } from './bridge/export-api';
import type { ResourceEntry } from 'blc-plugin-sdk';

export function App() {
  const session=getSession();
  const state=session.state as {mode?:string}|null;
  const [selection,setSelection]=useState<{chapterId?:string;folderPath?:string}|null>(state?.mode==='article'&&session.context.documentId ? {chapterId:session.context.documentId}:null);
  const [path,setPath]=useState('');const [entries,setEntries]=useState<ResourceEntry[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{const home=()=>setSelection(null);window.addEventListener('export:home',home);return()=>window.removeEventListener('export:home',home);},[]);
  useEffect(()=>{if(selection)return;let alive=true;setBusy(true);setError('');listResources(path).then(value=>{if(alive)setEntries(value);}).catch(error=>{if(alive)setError(String(error.message||error));}).finally(()=>{if(alive)setBusy(false);});return()=>{alive=false;};},[path,selection]);
  if(selection)return <TypesetPage novelId={workspaceTarget().workspaceId} {...selection}/>;
  return <div className="exportHome">
    <header><div><h1>排版导出</h1><p>将文章排成文档、长图，或整理成一本书。</p></div><span className="offlineBadge">离线排版</span></header>
    <section className="exportIntro"><strong>选择文章或文件夹</strong><p>文章支持 PDF、Word、HTML、PNG；书籍支持 EPUB、PDF、Word、HTML。</p></section>
    <div className="folderBar"><button className="lbBtn" disabled={!path||busy} onClick={()=>setPath(path.split('/').slice(0,-1).join('/'))}>上一级</button><span>{path||'工作区'}</span><button className="lbBtn lbBtnPrimary" disabled={busy||!!error} onClick={()=>setSelection({folderPath:path})}>将此文件夹制作成书籍</button></div>
    {busy?<p role="status">正在读取文稿…</p>:error?<p role="alert">{error}</p>:<div className="resourceList">{entries.filter(entry=>!entry.Name.startsWith('.')&&(entry.IsDir||/\.(md|markdown|txt)$/i.test(entry.Rel))).map(entry=><button key={entry.Rel} onClick={()=>entry.IsDir?setPath(entry.Rel):setSelection({chapterId:entry.Rel})}><span>{entry.IsDir?'文件夹':'文章'}</span><strong>{entry.Title||entry.Name}</strong><span>{entry.IsDir?'打开 →':'排版 →'}</span></button>)}</div>}
  </div>;
}
