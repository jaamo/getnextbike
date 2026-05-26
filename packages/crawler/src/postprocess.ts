import type { StockStatus } from './types';

// post_process_json shape for price / original_price selectors.
// Example: { "strip": ["€", " "], "decimal": ",", "thousands": ".", "currency": "EUR" }
interface PricePostProcess {
  strip?: string | string[];
  decimal?: ',' | '.';
  thousands?: ',' | '.' | ' ' | '';
  currency?: string;
}

interface PriceResult {
  amount: number;
  currency: string | null;
}

export function normalizePrice(
  raw: string,
  opts: Record<string, unknown> | null,
): PriceResult | null {
  const cfg = (opts ?? {}) as PricePostProcess;
  let s = raw.trim();

  // Strip configured substrings first so they don't confuse currency sniffing.
  const stripList = Array.isArray(cfg.strip) ? cfg.strip : cfg.strip ? [cfg.strip] : [];
  for (const t of stripList) s = s.split(t).join('');

  const currency = cfg.currency ?? sniffCurrency(raw);

  // Pull the numeric run out, including separators.
  const numericMatch = s.match(/-?[\d.,\s]+/);
  if (!numericMatch) return null;
  let numStr = numericMatch[0].replace(/\s+/g, '');

  const decimal = cfg.decimal ?? guessDecimal(numStr);
  const thousands = cfg.thousands ?? (decimal === ',' ? '.' : ',');

  if (thousands) numStr = numStr.split(thousands).join('');
  if (decimal !== '.') numStr = numStr.replace(decimal, '.');

  const amount = Number(numStr);
  if (!Number.isFinite(amount)) return null;
  return { amount, currency: currency ?? null };
}

function sniffCurrency(raw: string): string | null {
  if (/€/.test(raw) || /\bEUR\b/i.test(raw)) return 'EUR';
  if (/£/.test(raw) || /\bGBP\b/i.test(raw)) return 'GBP';
  if (/\$/.test(raw) || /\bUSD\b/i.test(raw)) return 'USD';
  if (/kr\b/i.test(raw) || /\b(SEK|NOK|DKK)\b/.test(raw)) {
    const code = raw.match(/\b(SEK|NOK|DKK)\b/i)?.[0]?.toUpperCase();
    return code ?? 'SEK';
  }
  return null;
}

function guessDecimal(numStr: string): ',' | '.' {
  // If both separators appear, the rightmost one is the decimal.
  const lastDot = numStr.lastIndexOf('.');
  const lastComma = numStr.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) return lastDot > lastComma ? '.' : ',';
  // Only one — decide by position. A separator within 3 of the end with no
  // other separators is the decimal; otherwise it's likely thousands.
  if (lastComma >= 0 && lastDot < 0) {
    return numStr.length - lastComma <= 3 ? ',' : '.';
  }
  if (lastDot >= 0 && lastComma < 0) {
    return numStr.length - lastDot <= 3 ? '.' : ',';
  }
  return '.';
}

// post_process_json shape for stock selectors.
// Example: { "mapping": { "in_stock": ["in stock", "available now"], "out_of_stock": ["sold out"] } }
// Values are case-insensitive substring matches. If no config matches, the
// default heuristics below run; if those don't match either, status is `unknown`.
interface StockPostProcess {
  mapping?: Partial<Record<StockStatus, string[]>>;
}

const DEFAULT_STOCK_RULES: Array<[StockStatus, RegExp]> = [
  ['out_of_stock', /\b(out of stock|sold out|ei varastossa|loppu)\b/i],
  ['in_stock', /\b(in stock|available|varastossa|saatavilla)\b/i],
  ['low_stock', /\b(low stock|only .* left|vain .* j[äa]ljell)\b/i],
  ['preorder', /\bpre[- ]?order\b/i],
  ['backorder', /\bback[- ]?order\b/i],
  ['discontinued', /\b(discontinued|no longer available)\b/i],
];

export function normalizeStock(raw: string, opts: Record<string, unknown> | null): StockStatus {
  const cfg = (opts ?? {}) as StockPostProcess;
  const lower = raw.toLowerCase();
  if (cfg.mapping) {
    for (const [status, needles] of Object.entries(cfg.mapping) as Array<
      [StockStatus, string[] | undefined]
    >) {
      if (!needles) continue;
      for (const needle of needles) {
        if (lower.includes(needle.toLowerCase())) return status;
      }
    }
  }
  for (const [status, re] of DEFAULT_STOCK_RULES) {
    if (re.test(raw)) return status;
  }
  return 'unknown';
}

export function normalizeTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}
