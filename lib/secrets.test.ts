import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.output', '.wxt', '.git']);
const KEY_RE = /\b(?:sk-[a-zA-Z0-9]{16,}|tvly-[a-zA-Z0-9]{16,}|tvly_[a-zA-Z0-9]{16,})\b/;

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else if (/\.(ts|tsx|js|mjs|json|md|html|css|txt)$/.test(name)) acc.push(path);
  }
  return acc;
}

describe('repository secrets', () => {
  it('does not contain live API key tokens in source or docs', () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const text = readFileSync(file, 'utf8');
      if (KEY_RE.test(text)) hits.push(file.replace(ROOT, ''));
    }
    expect(hits).toEqual([]);
  });
});
