import { waitForTask, type Json } from 'blc-plugin-sdk';
import { getSDK } from '../bridge/sdk';
async function invoke<T>(command:string,args:Json):Promise<T> {
  const sdk=getSDK();const task=await sdk.commands.invoke(command,args);
  return (await waitForTask(sdk.tasks,task.id,{timeoutMs:600_000})).result as T;
}
export async function saveExportBlob(blob:Blob,filename:string):Promise<{path?:string;cancelled:boolean}> {
  const started=await invoke<{id?:string;cancelled:boolean}>('save.begin',{filename,size:blob.size});
  if(started.cancelled||!started.id)return {cancelled:true};
  const id=started.id;
  try {
    for(let offset=0;offset<blob.size;offset+=192*1024) {
      const bytes=new Uint8Array(await blob.slice(offset,offset+192*1024).arrayBuffer());
      let binary='';for(let index=0;index<bytes.length;index+=8192)binary+=String.fromCharCode(...bytes.subarray(index,index+8192));
      const reply=await invoke<{offset:number}>('save.chunk',{id,offset,data:btoa(binary)});
      if(reply.offset!==offset+bytes.length)throw new Error('文件传输校验失败');
    }
    return await invoke('save.finish',{id});
  } catch(error) {await invoke('save.abort',{id}).catch(()=>{});throw error;}
}
