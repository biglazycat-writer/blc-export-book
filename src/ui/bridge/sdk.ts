import type { BrowserAPI } from 'blc-plugin-sdk/browser';
import type { ViewSession } from 'blc-plugin-sdk';
let api: BrowserAPI;
let session: ViewSession;
export function configureSDK(value: BrowserAPI, view: ViewSession) { api=value; session=view; }
export function getSDK() { if (!api) throw new Error('插件页面尚未连接'); return api; }
export function getSession() { if (!session) throw new Error('插件页面尚未连接'); return session; }
export function workspaceTarget() {
  const {workspaceId,workspaceSession}=getSession().context;
  if (!workspaceId || !workspaceSession) throw new Error('请先打开工作区，再打开排版导出插件');
  return {workspaceId,workspaceSession};
}
