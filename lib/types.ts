export type PersonRole = 'author' | 'editor' | 'manual';

export type Verdict = 'confirmed' | 'possible' | 'unrelated' | 'not_found';

export type Relation =
  | 'alumni'
  | 'faculty'
  | 'student'
  | 'honorary'
  | 'mentioned_only'
  | 'unknown';

export type CheckStatus = 'idle' | 'checking' | 'done' | 'error';

export type SearchProviderId = 'bocha' | 'serper' | 'tavily';

export interface ExtractedPerson {
  id: string;
  name: string;
  role: PersonRole;
  rawText: string;
  orgHint?: string;
}

export interface LocalPerson extends ExtractedPerson {
  element?: Element | null;
}

export interface SearchSnippet {
  title: string;
  url: string;
  snippet: string;
}

export interface Quote {
  text: string;
  url: string;
}

export interface CheckResult {
  person: ExtractedPerson;
  status: CheckStatus;
  verdict?: Verdict;
  relation?: Relation;
  reason?: string;
  quotes?: Quote[];
  sources?: SearchSnippet[];
  error?: string;
  checkedAt?: number;
  fromCache?: boolean;
  paidHint?: boolean;
  searchCalls?: number;
}

export interface Settings {
  deepseekApiKey: string;
  deepseekBaseUrl: string;
  deepseekModel: string;
  searchProvider: SearchProviderId;
  searchApiKey: string;
  autoCheck: boolean;
  showUnconfirmedBadges: boolean;
  usageWarnPercent: number;
}

export type ScanPhase = 'idle' | 'extracting' | 'checking';

export interface ScanProgress {
  phase: ScanPhase;
  message: string;
  done: number;
  total: number;
}

export interface SearchUsage {
  provider: SearchProviderId;
  used: number;
  limit: number | null;
  plan?: string;
  paygo: boolean;
  warn: boolean;
  extraPay: boolean;
  percent: number | null;
  source: 'tavily' | 'local';
  error?: string;
  fetchedAt: number;
}

export interface PageState {
  tabId: number;
  pageUrl: string;
  pageTitle: string;
  autoCheck: boolean;
  configured: boolean;
  results: CheckResult[];
  usage?: SearchUsage | null;
  scan?: ScanProgress;
}

export interface JudgeOutput {
  verdict: Verdict;
  relation: Relation;
  reason: string;
  quotes: Quote[];
  confidence?: number;
}
