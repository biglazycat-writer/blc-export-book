import '../../shims/iterator';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { installStreamAsyncIteration } from '../../shims/stream-async-iteration';
export type {PDFDocumentProxy} from 'pdfjs-dist';
installStreamAsyncIteration();
const root=new URL('./runtime/pdfjs/',document.baseURI).href;
GlobalWorkerOptions.workerSrc=root+'worker.mjs';
export async function loadPDFDocumentFromBytes(data:Uint8Array) {
  return getDocument({data:data.slice(),cMapUrl:root+'cmaps/',cMapPacked:true,standardFontDataUrl:root+'standard_fonts/',wasmUrl:root+'wasm/',iccUrl:root+'iccs/',enableXfa:false}).promise;
}
