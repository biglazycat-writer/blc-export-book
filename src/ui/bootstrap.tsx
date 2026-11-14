import {connect} from 'blc-plugin-sdk/browser';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {configureSDK} from './bridge/sdk';
import './i18n';
import './app.css';
import 'katex/dist/katex.min.css';

const root=document.getElementById('app')!;
try {
  const sdk=await connect();
  const session=await sdk.context();
  configureSDK(sdk,session);
  const appearance=(mode:string)=>{document.documentElement.dataset.colorScheme=mode;document.documentElement.style.colorScheme=mode;};
  appearance(sdk.appearance.getColorScheme());sdk.appearance.onDidChangeColorScheme(appearance);
  sdk.onSave(()=>sdk.setState(session.state||{},false));
  const {App}=await import('./App');
  flushSync(() => createRoot(root).render(<App/>));
  await sdk.ready();
}catch(error){root.textContent=`排版导出加载失败：${error instanceof Error?error.message:String(error)}`;}
