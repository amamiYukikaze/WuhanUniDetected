import { describe, expect, it } from 'vitest';
import { isWebPageSender } from './sender';

describe('isWebPageSender', () => {
  it('treats options/popup/sidepanel as extension pages even when Chrome sets sender.tab', () => {
    expect(
      isWebPageSender({
        url: 'chrome-extension://ckkpkahnimeindomcchlfmjkfnifadfn/options.html',
        origin: 'chrome-extension://ckkpkahnimeindomcchlfmjkfnifadfn',
      }),
    ).toBe(false);
    expect(
      isWebPageSender({
        url: 'chrome-extension://abc/popup.html',
      }),
    ).toBe(false);
  });

  it('treats content-script frames as web pages', () => {
    expect(isWebPageSender({ url: 'https://www.thepaper.cn/newsDetail_forward_1' })).toBe(true);
    expect(isWebPageSender({ origin: 'https://www.people.com.cn' })).toBe(true);
    expect(isWebPageSender({ url: 'http://example.com/' })).toBe(true);
  });
});
