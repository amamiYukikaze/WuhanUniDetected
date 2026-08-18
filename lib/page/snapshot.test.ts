import { describe, expect, it } from 'vitest';
import { Window } from 'happy-dom';
import { collectPageSnapshot } from './snapshot';

function htmlDoc(html: string): Document {
  const window = new Window();
  window.document.write(`<!doctype html><html><head><title>试稿</title></head><body>${html}</body></html>`);
  return window.document as unknown as Document;
}

describe('collectPageSnapshot', () => {
  it('keeps byline/article text and drops comment widgets', () => {
    const doc = htmlDoc(`
      <script type="application/ld+json">{"@type":"NewsArticle","author":{"name":"王嘉琦"}}</script>
      <article>
        <p>正文段落。</p>
        <div class="edit">责编：张三</div>
      </article>
      <div class="comment">李四说得对</div>
      <script>window.tracker = 1</script>
    `);
    const snap = collectPageSnapshot(doc, 'https://www.people.com.cn/n1/demo.html', '试稿');
    expect(snap).toContain('责编：张三');
    expect(snap).toContain('JSON-LD author: 王嘉琦');
    expect(snap).not.toContain('李四说得对');
    expect(snap).not.toContain('window.tracker');
  });
});
