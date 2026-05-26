import * as cheerio from 'cheerio';
import type { SelectorMatch, SelectorSpec } from './types';

// Apply a selector version against a fetched HTML document and return the
// raw extracted string (pre-postprocess). Postprocessing runs separately.
//
// Supported selector types in Phase 2:
//   - css         "selector"  or  "selector::attr(name)"  or  "selector::text"
//   - meta_tag    sugar for meta[property|name="<expr>"]::attr(content)
//   - regex       /pattern/flags  or  bare pattern (defaults to flags 'm')
//
// xpath / json_path are accepted by the schema but not implemented yet —
// they return `selector_missed` so a misconfigured selector is loud rather
// than silently broken. Phase 3 will add them when there's a real consumer.
export function applySelector(html: string, spec: SelectorSpec): SelectorMatch {
  switch (spec.selectorType) {
    case 'css':
      return applyCss(html, spec.expression);
    case 'meta_tag':
      return applyMetaTag(html, spec.expression);
    case 'regex':
      return applyRegex(html, spec.expression);
    case 'xpath':
    case 'json_path':
      return {
        raw: null,
        outcome: 'selector_missed',
        message: `selector_type ${spec.selectorType} not implemented in Phase 2`,
      };
    default: {
      const _exhaustive: never = spec.selectorType;
      return {
        raw: null,
        outcome: 'parse_failed',
        message: `unknown selector type ${_exhaustive}`,
      };
    }
  }
}

function applyCss(html: string, expression: string): SelectorMatch {
  const { selector, op, arg } = parseCssExpression(expression);
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    return { raw: null, outcome: 'parse_failed', message: (err as Error).message };
  }

  let el: ReturnType<typeof $>;
  try {
    el = $(selector);
  } catch (err) {
    return { raw: null, outcome: 'parse_failed', message: (err as Error).message };
  }
  if (el.length === 0) return { raw: null, outcome: 'selector_missed' };

  let raw: string | null = null;
  if (op === 'attr' && arg) raw = el.first().attr(arg) ?? null;
  else if (op === 'html') raw = el.first().html();
  else raw = el.first().text();

  if (raw == null || raw.trim() === '') return { raw: null, outcome: 'selector_missed' };
  return { raw, outcome: 'success' };
}

function applyMetaTag(html: string, name: string): SelectorMatch {
  const escaped = name.replace(/"/g, '\\"');
  return applyCss(
    html,
    `meta[property="${escaped}"]::attr(content), meta[name="${escaped}"]::attr(content)`,
  );
}

function applyRegex(html: string, expression: string): SelectorMatch {
  let pattern = expression;
  let flags = 'm';
  // Allow /pattern/flags syntax.
  const slashFormat = expression.match(/^\/(.+)\/([gimsuy]*)$/);
  if (slashFormat?.[1] != null) {
    pattern = slashFormat[1];
    flags = slashFormat[2] || 'm';
  }
  let re: RegExp;
  try {
    re = new RegExp(pattern, flags);
  } catch (err) {
    return { raw: null, outcome: 'parse_failed', message: (err as Error).message };
  }
  const match = re.exec(html);
  if (!match) return { raw: null, outcome: 'selector_missed' };
  const raw = match[1] ?? match[0];
  if (!raw || raw.trim() === '') return { raw: null, outcome: 'selector_missed' };
  return { raw, outcome: 'success' };
}

interface ParsedCss {
  selector: string;
  op: 'text' | 'attr' | 'html';
  arg?: string;
}

function parseCssExpression(expression: string): ParsedCss {
  // ::attr(name) — read an attribute.
  const attr = expression.match(/^(.*)::attr\(([^)]+)\)\s*$/);
  if (attr?.[1] != null && attr[2] != null) {
    return { selector: attr[1].trim(), op: 'attr', arg: attr[2].trim() };
  }
  // ::html — read inner HTML.
  if (expression.endsWith('::html')) {
    return { selector: expression.slice(0, -'::html'.length).trim(), op: 'html' };
  }
  // ::text (or no suffix) — read text content.
  if (expression.endsWith('::text')) {
    return { selector: expression.slice(0, -'::text'.length).trim(), op: 'text' };
  }
  return { selector: expression.trim(), op: 'text' };
}
