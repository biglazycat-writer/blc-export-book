// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureSDK } from './bridge/sdk';
import { App } from './App';
import { listResources } from './bridge/export-api';
import type { ResourceEntry } from 'blc-plugin-sdk';
vi.mock('./features/typeset/TypesetPage',()=>({TypesetPage:({folderPath,chapterId}:{folderPath?:string;chapterId?:string})=><div data-testid="target">{JSON.stringify({folderPath,chapterId})}</div>}));
vi.mock('./bridge/export-api',()=>({listResources:vi.fn(async()=>[])}));
beforeEach(()=>{
  configureSDK({} as never,{context:{workspaceId:'w',workspaceSession:'s'},state:{mode:'book'}} as never);
  vi.mocked(listResources).mockResolvedValue([]);
});
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('opens the selected folder, including the workspace root, on every fresh page',()=>{
  for(const folderPath of ['第一本','第二本','']) {
    configureSDK({} as never,{context:{workspaceId:'w',workspaceSession:'s',documentId:'stale'},state:{mode:'book',folderPath}} as never);
    const view=render(<App/>);expect(screen.getByTestId('target').textContent).toBe(JSON.stringify({folderPath}));view.unmount();
  }
});
it('selects a folder directly without first entering it',async()=>{
  vi.mocked(listResources).mockResolvedValue([{Rel:'作品集',Name:'作品集',IsDir:true}] as ResourceEntry[]);
  render(<App/>);
  fireEvent.click(await screen.findByRole('button',{name:'选择此文件夹制作书籍：作品集'}));
  expect(screen.getByTestId('target').textContent).toBe(JSON.stringify({folderPath:'作品集'}));
  expect(listResources).toHaveBeenCalledTimes(1);
});
it('browses, goes up, and selects the current folder independently',async()=>{
  vi.mocked(listResources).mockImplementation(async path=>path===''?[{Rel:'作品集',Name:'作品集',IsDir:true}] as ResourceEntry[]:[]);
  render(<App/>);
  fireEvent.click(await screen.findByRole('button',{name:'浏览文件夹：作品集'}));
  await waitFor(()=>expect(listResources).toHaveBeenLastCalledWith('作品集'));
  expect(screen.queryByTestId('target')).toBeNull();
  await waitFor(()=>expect((screen.getByRole('button',{name:'上一级'}) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'上一级'}));
  await screen.findByRole('button',{name:'浏览文件夹：作品集'});
  fireEvent.click(screen.getByRole('button',{name:'将此文件夹制作成书籍'}));
  expect(screen.getByTestId('target').textContent).toBe(JSON.stringify({folderPath:''}));
});
it('still selects individual articles',async()=>{
  vi.mocked(listResources).mockResolvedValue([{Rel:'一章.md',Name:'一章.md',Title:'一章',IsDir:false}] as ResourceEntry[]);
  render(<App/>);fireEvent.click(await screen.findByRole('button',{name:'排版文章：一章'}));
  expect(screen.getByTestId('target').textContent).toBe(JSON.stringify({chapterId:'一章.md'}));
});
