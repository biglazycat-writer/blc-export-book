import {describe,it,expect} from 'vitest';
import {base64ByteLength} from './data-url';

describe('base64 byte length',()=>{
 it('decodes padding variants exactly like the binary payload',()=>{
  expect(base64ByteLength('')).toBe(0);
  expect(base64ByteLength('QQ==')).toBe(1);       // 'A'
  expect(base64ByteLength('QUI=')).toBe(2);      // 'AB'
  expect(base64ByteLength('QUJD')).toBe(3);      // 'ABC'
 });
 it('handles multi-chunk payloads and clamps malformed input',()=>{
  expect(base64ByteLength('QUJDREVG')).toBe(6);
  expect(base64ByteLength('=')).toBe(0);
  expect(base64ByteLength('A')).toBe(0);
 });
});
