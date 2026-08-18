import { readCache, writeCache } from '../cache';
import type { CheckResult, ExtractedPerson, Settings } from '../types';
import { judgePerson } from './judge';
import { searchPerson } from './search';
import { addLocalSearchCredits, getSearchUsage, invalidateUsageCache } from './usage';

export async function verifyPerson(
  person: ExtractedPerson,
  settings: Settings,
): Promise<CheckResult> {
  const cached = await readCache(person.name, person.orgHint);
  if (cached) {
    return {
      person,
      status: 'done',
      verdict: cached.verdict,
      relation: cached.relation,
      reason: cached.reason,
      quotes: cached.quotes,
      sources: cached.sources,
      checkedAt: cached.savedAt,
      fromCache: true,
    };
  }

  const usage = await getSearchUsage(settings);
  const paidHint = Boolean(usage?.extraPay);
  const { snippets, queryCount } = await searchPerson(
    person.name,
    settings,
    person.orgHint,
    person.role,
  );
  await addLocalSearchCredits(queryCount);
  if (settings.searchProvider === 'tavily') {
    await invalidateUsageCache();
  }
  const judged = await judgePerson(person.name, snippets, settings, person.orgHint);
  await writeCache(person.name, person.orgHint, { ...judged, sources: snippets });

  return {
    person,
    status: 'done',
    verdict: judged.verdict,
    relation: judged.relation,
    reason: judged.reason,
    quotes: judged.quotes,
    sources: snippets,
    checkedAt: Date.now(),
    fromCache: false,
    paidHint,
    searchCalls: queryCount,
  };
}
