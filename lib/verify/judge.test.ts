import { describe, expect, it } from 'vitest';
import { validateJudgeOutput } from './judge';
import type { SearchSnippet } from '../types';

const BAIKE_URL = 'https://baike.baidu.com/item/%E5%BC%A0%E4%B8%89';

const snippets: SearchSnippet[] = [
  {
    title: '张三_百度百科',
    url: BAIKE_URL,
    snippet: '张三，记者，毕业于武汉大学新闻学院。',
  },
];

describe('validateJudgeOutput', () => {
  it('keeps confirmed when quote exists in snippets', () => {
    const out = validateJudgeOutput(
      {
        verdict: 'confirmed',
        relation: 'alumni',
        reason: '百科写明毕业院校',
        quotes: [{ text: '毕业于武汉大学新闻学院', url: BAIKE_URL }],
      },
      snippets,
    );
    expect(out.verdict).toBe('confirmed');
    expect(out.quotes).toHaveLength(1);
  });

  it('downgrades confirmed without supporting quote', () => {
    const out = validateJudgeOutput(
      {
        verdict: 'confirmed',
        relation: 'alumni',
        reason: '我记得他是武大的',
        quotes: [{ text: '这段话并不在片段里出现过啊啊', url: BAIKE_URL }],
      },
      snippets,
    );
    expect(out.verdict).toBe('possible');
    expect(out.quotes).toHaveLength(0);
  });

  it('rejects javascript URLs in quotes', () => {
    const out = validateJudgeOutput(
      {
        verdict: 'confirmed',
        relation: 'alumni',
        reason: '百科写明毕业院校',
        quotes: [{ text: '毕业于武汉大学新闻学院', url: 'javascript:alert(1)' }],
      },
      snippets,
    );
    expect(out.verdict).toBe('possible');
    expect(out.quotes).toHaveLength(0);
  });

  it('treats mentioned_only confirmed as unrelated', () => {
    const out = validateJudgeOutput(
      {
        verdict: 'confirmed',
        relation: 'mentioned_only',
        reason: '他写过武大新闻',
        quotes: [{ text: '毕业于武汉大学新闻学院', url: BAIKE_URL }],
      },
      snippets,
    );
    expect(out.verdict).toBe('unrelated');
  });
});
