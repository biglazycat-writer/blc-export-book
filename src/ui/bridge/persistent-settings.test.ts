import {it,expect} from 'vitest';
import {configureSDK} from './sdk';
import {loadPersistedSettings,savePersistedSettings} from './persistent-settings';
import {createDefaultWorkExportSettings} from '../features/novels/work-export/presets';
it('persists large covers through bounded SDK chunks across page sessions and isolates workspaces',async()=>{
 const data=new Map<string,unknown>();let writes=0;
 const sdk={storage:{get:async(key:string,workspace:string)=>data.get(workspace+key)??null,set:async(key:string,value:unknown,workspace:string)=>{expect(new TextEncoder().encode(JSON.stringify(value)).length).toBeLessThanOrEqual(65536);data.set(workspace+key,value);writes++;}}};
 configureSDK(sdk as never,{context:{workspaceId:'a',workspaceSession:'1'}} as never);
 const settings=createDefaultWorkExportSettings({title:'书籍'});settings.branding.coverDataUrl='data:image/png;base64,'+'A'.repeat(180000);settings.common.author='作者';
 await savePersistedSettings('book',settings);
 const initialWrites=writes;await savePersistedSettings('book',settings);expect(writes).toBe(initialWrites);
 configureSDK(sdk as never,{context:{workspaceId:'a',workspaceSession:'2'}} as never);
 expect(await loadPersistedSettings('book',{title:'默认'})).toEqual(settings);
 settings.common.title='新书名';await savePersistedSettings('book',settings);expect((await loadPersistedSettings('book',{title:'默认'})).common.title).toBe('新书名');
 configureSDK(sdk as never,{context:{workspaceId:'b',workspaceSession:'3'}} as never);
 expect((await loadPersistedSettings('book',{title:'默认'})).common.title).toBe('默认');
});
