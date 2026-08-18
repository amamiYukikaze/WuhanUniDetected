import { makePerson, orgHintForHost } from '../hosts';
import { isLikelyPersonName, normalizeName } from '../normalize';
import type { ExtractedPerson, PersonRole, Settings } from '../types';
import { chatJsonObject } from './llm';

export const MAX_EXTRACTED_PEOPLE = 12;

const SYSTEM_PROMPT = `你是新闻稿署名抽取助手。用户会提供一篇中文新闻页的清洗文本（已去掉脚本和评论区）。

只抽取「本稿署名人员」：作者、记者、通讯员、撰文、执笔、责编、责任编辑、编辑、校对、摄影/视觉编辑等写在署名栏或文首文末的人。

不要抽取：
- 评论区、跟帖、网友
- 正文里被报道的官员、企业人物、受访者、历史人物（除非他们同时也是本稿署名记者/作者）
- 地名、机构名、媒体名（如人民日报、新华社、全文、广东、江苏）

最多 ${MAX_EXTRACTED_PEOPLE} 个，宁缺毋滥。
记者/作者/通讯员/撰文 → role=author；编辑/责编/校对/摄影编辑 → role=editor。
只输出 JSON：
{ "people": [ { "name": "张三", "role": "author" | "editor", "evidence": "原文里的短句" } ] }`;

export interface ParsedExtractedName {
  name: string;
  role: PersonRole;
  evidence: string;
}

export function parseExtractedPeople(raw: unknown): ParsedExtractedName[] {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(obj.people) ? obj.people : [];
  const seen = new Set<string>();
  const out: ParsedExtractedName[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { name?: unknown; role?: unknown; evidence?: unknown };
    const name = normalizeName(typeof row.name === 'string' ? row.name : '');
    if (!isLikelyPersonName(name) || seen.has(name)) continue;
    const role: PersonRole = row.role === 'editor' ? 'editor' : 'author';
    const evidence = typeof row.evidence === 'string' ? row.evidence.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    seen.add(name);
    out.push({ name, role, evidence });
    if (out.length >= MAX_EXTRACTED_PEOPLE) break;
  }
  return out;
}

export async function extractPeopleFromSnapshot(
  snapshot: string,
  hostname: string,
  settings: Settings,
): Promise<ExtractedPerson[]> {
  const raw = await chatJsonObject(
    settings,
    SYSTEM_PROMPT,
    `请从下面的新闻页摘录里找出本稿署名人员。\n\n${snapshot}`,
  );
  const orgHint = orgHintForHost(hostname);
  return parseExtractedPeople(raw).map((item) =>
    makePerson(item.name, item.role, item.evidence || item.name, orgHint),
  );
}
