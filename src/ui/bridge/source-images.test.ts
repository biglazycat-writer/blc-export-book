import {it,expect} from 'vitest';
import {resolveSourceImages,sourceWordCount} from './source-images';
it('resolves each chapter image relative to its own folder, preserving remote and code examples',()=>{
 const raw='![图片](../图/封面%20一.png)\n\n![网络](https://example.com/a.png)\n\n```md\n![示例](missing.png)\n```';
 const result=JSON.parse(resolveSourceImages(raw,'文章/第一章.md','ws'));
 expect(result.content[0].attrs.src).toBe('/creation-image/ws/%E5%9B%BE/%E5%B0%81%E9%9D%A2%20%E4%B8%80.png');
 expect(result.content[1].attrs.src).toBe('https://example.com/a.png');
 expect(JSON.stringify(result)).toContain('![示例](missing.png)');
 expect(resolveSourceImages('纯文本','a.md','ws')).toBe('纯文本');
 expect(()=>resolveSourceImages('![图片](../a.png)','a.md','ws')).toThrow('超出工作区');
 expect(sourceWordCount(resolveSourceImages('正文文字\n\n![图片](a.png)','a.md','ws'))).toBe(4);
});
