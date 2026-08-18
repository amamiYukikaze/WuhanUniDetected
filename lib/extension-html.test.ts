import { describe, expect, it } from 'vitest';
import { sanitizeExtensionHtml } from './extension-html';

describe('sanitizeExtensionHtml', () => {
  it('strips modulepreload and crossorigin that trigger Edge cross-world warnings', () => {
    const html = `<!DOCTYPE html>
<html>
  <head>
    <script type="module" crossorigin src="/chunks/popup-aaa.js"></script>
    <link rel="modulepreload" crossorigin href="/chunks/ui-bbb.js">
    <link rel="stylesheet" crossorigin href="/assets/ui.css">
  </head>
  <body></body>
</html>`;
    const out = sanitizeExtensionHtml(html);
    expect(out).not.toMatch(/modulepreload/i);
    expect(out).not.toMatch(/crossorigin/i);
    expect(out).toContain('src="/chunks/popup-aaa.js"');
    expect(out).toContain('href="/assets/ui.css"');
  });
});
