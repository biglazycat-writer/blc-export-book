import {storedDocFromRaw} from '../lib/content-model';
type Node={type?:string;text?:string;attrs?:Record<string,unknown>;content?:Node[]};
export function sourceWordCount(raw:string):number {
  const count=(node:Node):number=>(node.text?.replace(/\s/g,'').length||0)+(node.content||[]).reduce((total,child)=>total+count(child),0);
  return count(storedDocFromRaw(raw) as Node);
}
/** Resolve saved Markdown image paths before combining chapters from different folders. */
export function resolveSourceImages(raw:string,documentPath:string,workspaceId:string):string {
  const doc=storedDocFromRaw(raw) as Node;
  let changed=false;
  const visit=(node:Node)=>{
    const src=node.type==='image'&&typeof node.attrs?.src==='string'?node.attrs.src:'';
    if(src&&!/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src)){
      const local=src.split(/[?#]/)[0];
      let decoded:string;try{decoded=decodeURIComponent(local);}catch{throw new Error('图片路径编码无效');}
      if(!/\.(png|jpe?g|webp|gif|svg|bmp|avif|ico|tiff?)$/i.test(decoded))return;
      const parts=documentPath.replaceAll('\\','/').split('/').slice(0,-1);
      for(const part of decoded.split('/')){
        if(!part||part==='.')continue;
        if(part==='..'){if(!parts.length)throw new Error('图片路径超出工作区');parts.pop();}else parts.push(part);
      }
      // This is an image identifier passed to SDK images.read, never a URL fetched by this page.
      node.attrs={...node.attrs,src:`/creation-image/${encodeURIComponent(workspaceId)}/${parts.map(encodeURIComponent).join('/')}`};changed=true;
    }
    node.content?.forEach(visit);
  };
  visit(doc);return changed?JSON.stringify(doc):raw;
}
