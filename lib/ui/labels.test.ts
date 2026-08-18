import { describe, expect, it } from 'vitest';
import { badgeLabel, verdictLabel } from './labels';

describe('verdict labels', () => {
  it('uses green copy for unrelated / not_found', () => {
    expect(verdictLabel('unrelated')).toBe('未查询到武汉大学成分~');
    expect(verdictLabel('not_found')).toBe('未查询到武汉大学成分~');
    expect(badgeLabel('unrelated')).toBe('未查询到武汉大学成分~');
    expect(badgeLabel('not_found')).toBe('未查询到武汉大学成分~');
  });

  it('uses yellow copy for possible', () => {
    expect(verdictLabel('possible')).toBe('疑似武汉大学，请仔细核查');
    expect(badgeLabel('possible')).toBe('疑似武汉大学，请仔细核查');
  });

  it('keeps red copy for confirmed', () => {
    expect(verdictLabel('confirmed')).toBe('检测到武汉大学成分！');
    expect(badgeLabel('confirmed')).toBe('检测到武汉大学成分！');
  });
});
