import robotsParser from 'robots-parser';

export type FetchOutcome =
  | { ok: true; html: string; httpStatus: number; fetchDurationMs: number }
  | {
      ok: false;
      kind: 'blocked' | 'timeout' | 'http_error' | 'network_error';
      httpStatus?: number;
      fetchDurationMs: number;
      errorClass: string;
      errorMessage: string;
    };

export interface FetcherOptions {
  userAgent: string;
  timeoutMs: number;
  // 'respect' = consult robots.txt; 'ignore_with_consent' = skip the check.
  // Defaults to 'respect' when null/undefined.
  robotsPolicy?: 'respect' | 'ignore_with_consent' | null;
}

interface RobotsEntry {
  fetchedAt: number;
  // Result of `robots-parser`. `unknown` to avoid leaking the lib's types.
  parser: ReturnType<typeof robotsParser>;
}

const ROBOTS_TTL_MS = 60 * 60 * 1000;

export class Fetcher {
  private readonly robotsCache = new Map<string, RobotsEntry>();

  constructor(private readonly defaults: FetcherOptions) {}

  async fetchPage(url: string, opts?: Partial<FetcherOptions>): Promise<FetchOutcome> {
    const merged: FetcherOptions = { ...this.defaults, ...opts };
    const policy = merged.robotsPolicy ?? 'respect';
    const startedAt = Date.now();

    if (policy === 'respect') {
      const allowed = await this.isAllowedByRobots(url, merged.userAgent);
      if (!allowed) {
        return {
          ok: false,
          kind: 'blocked',
          fetchDurationMs: Date.now() - startedAt,
          errorClass: 'robots_disallow',
          errorMessage: `robots.txt disallows ${url}`,
        };
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), merged.timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'user-agent': merged.userAgent, accept: 'text/html,*/*;q=0.8' },
      });
      const fetchDurationMs = Date.now() - startedAt;
      if (!res.ok) {
        return {
          ok: false,
          kind: 'http_error',
          httpStatus: res.status,
          fetchDurationMs,
          errorClass: 'http_error',
          errorMessage: `${res.status} ${res.statusText}`,
        };
      }
      const html = await res.text();
      return { ok: true, html, httpStatus: res.status, fetchDurationMs };
    } catch (err) {
      const fetchDurationMs = Date.now() - startedAt;
      const aborted = (err as { name?: string }).name === 'AbortError';
      return aborted
        ? {
            ok: false,
            kind: 'timeout',
            fetchDurationMs,
            errorClass: 'timeout',
            errorMessage: `timed out after ${merged.timeoutMs}ms`,
          }
        : {
            ok: false,
            kind: 'network_error',
            fetchDurationMs,
            errorClass: (err as Error).name || 'network_error',
            errorMessage: (err as Error).message,
          };
    } finally {
      clearTimeout(timer);
    }
  }

  private async isAllowedByRobots(url: string, userAgent: string): Promise<boolean> {
    let host: string;
    let robotsUrl: string;
    try {
      const parsed = new URL(url);
      host = parsed.host;
      robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
    } catch {
      return true;
    }

    const cached = this.robotsCache.get(host);
    const fresh = cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS;
    if (fresh) return cached.parser.isAllowed(url, userAgent) ?? true;

    // Fetch robots.txt; if unreachable, allow (open by default — common practice).
    let body = '';
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(robotsUrl, {
          signal: controller.signal,
          headers: { 'user-agent': userAgent },
        });
        if (res.ok) body = await res.text();
      } finally {
        clearTimeout(t);
      }
    } catch {
      // ignore — fall through with empty body (= no rules = allowed)
    }
    const parser = robotsParser(robotsUrl, body);
    this.robotsCache.set(host, { fetchedAt: Date.now(), parser });
    return parser.isAllowed(url, userAgent) ?? true;
  }
}
