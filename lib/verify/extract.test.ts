import { describe, expect, it } from 'vitest';
import { parseExtractedPeople } from './extract';

describe('parseExtractedPeople', () => {
  it('keeps credited names and drops places / comments', () => {
    const people = parseExtractedPeople({
      people: [
        { name: '王嘉琦', role: 'editor', evidence: '责任编辑：王嘉琦' },
        { name: '广东', role: 'author', evidence: '广东讯' },
        { name: '全文', role: 'author', evidence: '全文' },
        { name: '李四', role: 'author', evidence: '记者李四' },
      ],
    });
    expect(people.map((item) => item.name)).toEqual(['王嘉琦', '李四']);
    expect(people[0]?.role).toBe('editor');
  });
});
