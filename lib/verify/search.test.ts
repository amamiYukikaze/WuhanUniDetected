import { describe, expect, it } from 'vitest';
import { buildSearchQueries } from './search';

describe('buildSearchQueries', () => {
  it('joins name with Wuhan University and job title', () => {
    expect(buildSearchQueries('张三', '澎湃新闻', 'author')).toEqual([
      '"张三" 武汉大学',
      '"张三" 记者 武汉大学',
      '"张三" 澎湃新闻 武汉大学',
    ]);
  });

  it('uses bio query when role is manual', () => {
    expect(buildSearchQueries('张三', undefined, 'manual')).toEqual([
      '"张三" 武汉大学',
      '"张三" 简历 OR 简介',
      '"张三" site:baike.baidu.com',
    ]);
  });
});
