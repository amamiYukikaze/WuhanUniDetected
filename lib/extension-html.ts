/**
 * Chromium/Edge 扩展页里，Vite 默认会给 script/link 打上 crossorigin，
 * 并插入 <link rel="modulepreload">。这些请求走 CORS，真正的 ESM 导入却走
 * 扩展 world，于是 DevTools Issues 会报：
 * “preload … is not used because it is a cross-world extension resource mismatch.”
 */
export function sanitizeExtensionHtml(html: string): string {
  return html
    .replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>\s*/gi, '')
    .replace(/\s+crossorigin(?:="[^"]*")?/gi, '');
}
