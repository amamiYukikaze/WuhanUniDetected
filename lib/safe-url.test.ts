import { describe, expect, it } from 'vitest';
import { extraOriginFromBaseUrl, safeHref, sanitizeLlmBaseUrl } from './safe-url';

describe('safeHref', () => {
  it('allows http(s) and drops javascript/data', () => {
    expect(safeHref('https://baike.baidu.com/item/x')).toMatch(/^https:\/\//);
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
  });
});

describe('sanitizeLlmBaseUrl', () => {
  const fallback = 'https://api.deepseek.com';
  it('keeps public https origins and drops private/non-https', () => {
    expect(sanitizeLlmBaseUrl('https://api.openai.com/v1', fallback)).toBe('https://api.openai.com/v1');
    expect(sanitizeLlmBaseUrl('https://localhost/v1', fallback)).toBe(fallback);
    expect(sanitizeLlmBaseUrl('http://api.deepseek.com', fallback)).toBe(fallback);
  });
});

describe('extraOriginFromBaseUrl', () => {
  it('returns null for builtin DeepSeek origin', () => {
    expect(extraOriginFromBaseUrl('https://api.deepseek.com')).toBeNull();
  });
  it('asks for other https origins', () => {
    expect(extraOriginFromBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/*');
  });
});
