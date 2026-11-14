import { readDocument, type Invocation, type PluginContext, type SharedAPI } from 'blc-plugin-sdk';

export type ArticleSource = { key: string; parts: number; hash: string; documentId: string; resource: string };
export type ExportState = { mode?: string; folderPath?: string; articleSource?: ArticleSource };
const partLength = 8192;

async function digest(content: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Capture before opening the page: navigation may unmount the source editor.
// Keep content outside the 64 KiB view checkpoint so large drafts can reload.
export async function captureArticle(ctx: PluginContext, inv: Invocation): Promise<ArticleSource> {
  if (!inv.workspaceId || !inv.workspaceSession || !inv.documentId || !inv.editorId) throw new Error('请从文章编辑器打开排版导出');
  const doc = await readDocument(ctx.documents, {
    workspaceId: inv.workspaceId, workspaceSession: inv.workspaceSession,
    documentId: inv.documentId, editorId: inv.editorId, windowId: inv.windowId,
  }, { signal: inv.signal });
  const source: ArticleSource = {
    key: `article-${crypto.randomUUID()}`, parts: Math.max(1, Math.ceil(doc.content.length / partLength)),
    hash: doc.hash, documentId: inv.documentId, resource: inv.resource || '',
  };
  try {
    for (let index = 0; index < source.parts; index++) {
      inv.signal.throwIfAborted();
      await ctx.storage.set(`${source.key}-${index}`, doc.content.slice(index * partLength, (index + 1) * partLength), inv.workspaceId);
    }
    return source;
  } catch (error) {
    await discardArticle(ctx.storage, source, inv.workspaceId);
    throw error;
  }
}

export async function discardArticle(storage: SharedAPI['storage'], source: ArticleSource, workspaceId: string) {
  for (let index = 0; index < source.parts; index++) await storage.set(`${source.key}-${index}`, null, workspaceId);
}

export async function readArticle(storage: SharedAPI['storage'], source: ArticleSource, workspaceId: string): Promise<string> {
  if (!/^article-[a-f0-9-]{36}$/.test(source.key) || !Number.isSafeInteger(source.parts) || source.parts < 1 || source.parts > 4096) throw new Error('文章快照索引无效，请从文章重新打开排版导出');
  const chunks: string[] = [];
  for (let index = 0; index < source.parts; index++) {
    const part = await storage.get(`${source.key}-${index}`, workspaceId);
    if (typeof part !== 'string' || part.length > partLength) throw new Error('文章快照缺失，请从文章重新打开排版导出');
    chunks.push(part);
  }
  const content = chunks.join('');
  if (await digest(content) !== source.hash) throw new Error('文章快照校验失败，请从文章重新打开排版导出');
  return content;
}
