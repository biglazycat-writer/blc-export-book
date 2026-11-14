import {describe,it,expect} from 'vitest';
import JSZip from 'jszip';
import {canvasFromFile,mindMapFromBytes} from './embedded-files';
import {artifactToTree} from '../features/creative/artifact-tree';
import {canvasFile,mindMapArchive,mindMapId,snapshot} from '../../../tests/fixtures/embedded.mjs';

describe('authoritative embedded resource files',()=>{
 it('retains canvas layers, hidden elements, transforms, connectors and rendering settings',()=>{
  const result=canvasFromFile(canvasFile);
  expect(result.elements).toEqual(canvasFile.scene.elements);
  expect(result.connectors).toEqual(canvasFile.scene.connectors);
  expect(result.document.settings.hand_drawn).toBe(true);
  expect(()=>canvasFromFile({...canvasFile,schema_version:20})).toThrow(/版本/);
  expect(()=>canvasFromFile({...canvasFile,scene:undefined})).toThrow(/场景/);
 });
 it('reads native application identity, view state, formulas and graph from the xmind ZIP',async()=>{
  const result=await mindMapFromBytes(await mindMapArchive(),'导出导图.xmind');
  expect(result.id).toBe(mindMapId);expect(result.revision).toBe(2);
  expect(result.content.nodes).toEqual(snapshot.nodes);
  expect(result.content.rainbow).toEqual(snapshot.view.rainbow);
  const tree=artifactToTree(result);
  expect(tree.data.text).toBe('离线思维导图');expect(tree.children?.[0].data.formulaLatex).toBe('E=mc^2');
 });
 it('fails explicitly on unsupported application snapshots',async()=>{
  const zip=new JSZip();zip.file('biglazycat.json',JSON.stringify({...snapshot,schema:'9.0'}));
  await expect(mindMapFromBytes(await zip.generateAsync({type:'uint8array'}),'broken.xmind')).rejects.toThrow(/版本/);
 });
});
