import { build } from 'esbuild';
import { cp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const target='src/ui/public/runtime';
async function copy(from,to) {const path=resolve(target,to);await mkdir(dirname(path),{recursive:true});await cp(from,path,{recursive:true});}
await build({entryPoints:['src/main.ts'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:'dist/main.js'});
await copy('node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm','typesetting/typst_ts_web_compiler_bg.wasm');
for(const [packageName,weight,file] of [['noto-serif-sc','400Regular','NotoSerifSC_400Regular.ttf'],['noto-serif-sc','700Bold','NotoSerifSC_700Bold.ttf'],['noto-emoji','400Regular','NotoEmoji_400Regular.ttf'],['noto-sans-mono','400Regular','NotoSansMono_400Regular.ttf']])await copy(`node_modules/@expo-google-fonts/${packageName}/${weight}/${file}`,`typesetting/${file}`);
await copy('node_modules/pdfjs-dist/build/pdf.worker.mjs','pdfjs/pdf.worker.mjs');
for(const folder of ['cmaps','standard_fonts','wasm','iccs']) await copy('node_modules/pdfjs-dist/'+folder,'pdfjs/'+folder);
await copy('src/ui/shims/iterator.ts','pdfjs/iterator.mjs');
await writeFile(target+'/pdfjs/worker.mjs',"import './iterator.mjs';\nexport { WorkerMessageHandler } from './pdf.worker.mjs';\n");
await copy('assets/fonts','fonts');
await copy('node_modules/katex/LICENSE','licenses/katex.txt');
for(const name of ['noto-serif-sc','noto-emoji','noto-sans-mono']) {
  const dir='node_modules/@expo-google-fonts/'+name;
  for(const file of await readdir(dir))if(/^(OFL|LICENSE)/i.test(file))await copy(dir+'/'+file,'licenses/'+name+'-'+file);
}
console.log('Bundled backend, Typst, fonts and PDF preview resources.');
