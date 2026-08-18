import { describe, expect, it } from 'vitest';
import { applyLoadedSettings, DEFAULT_SETTINGS } from './settings';

describe('DEFAULT_SETTINGS', () => {
  it('does not auto-check on page load', () => {
    expect(DEFAULT_SETTINGS.autoCheck).toBe(false);
  });
});

describe('applyLoadedSettings', () => {
  it('forces autoCheck false even if storage had true', () => {
    expect(applyLoadedSettings({ autoCheck: true }).autoCheck).toBe(false);
  });

  it('rejects non-https or private LLM base URLs', () => {
    expect(applyLoadedSettings({ deepseekBaseUrl: 'http://evil.example/v1' }).deepseekBaseUrl).toBe(
      DEFAULT_SETTINGS.deepseekBaseUrl,
    );
    expect(applyLoadedSettings({ deepseekBaseUrl: 'https://127.0.0.1/v1' }).deepseekBaseUrl).toBe(
      DEFAULT_SETTINGS.deepseekBaseUrl,
    );
    expect(applyLoadedSettings({ deepseekBaseUrl: 'https://api.openai.com/v1' }).deepseekBaseUrl).toBe(
      'https://api.openai.com/v1',
    );
  });

  it('ignores unknown search providers', () => {
    expect(applyLoadedSettings({ searchProvider: 'evil' as never }).searchProvider).toBe('bocha');
  });
});
