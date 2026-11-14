import {expect,it} from 'vitest';
import {withoutRepeatedTitle} from './design';
it('omits an identical leading H1 while preserving other headings and content',()=>{
 expect(withoutRepeatedTitle('# 文章\n\n正文','文章')).toBe('正文');
 expect(withoutRepeatedTitle('# 文章 ###\r\n\r\n正文','文章')).toBe('正文');
 expect(withoutRepeatedTitle('# 正文标题\n\n正文','文章')).toBe('# 正文标题\n\n正文');
 expect(withoutRepeatedTitle('## 文章\n\n正文','文章')).toBe('## 文章\n\n正文');
});
