import type { Locale } from './locales';

/*
 * A small ICU MessageFormat subset, enough for the same message style as the website:
 *   "Hello {name}"
 *   "{count, plural, =0 {No guests} one {# guest} other {# guests}}"
 *   "{status, select, new {New} other {Other}}"
 * Nested braces inside plural/select branches are supported. Anything else is left as is.
 * Hermes has no Intl.PluralRules on every platform, so plural categories are decided here.
 */

export type MessageValues = Record<string, string | number | null | undefined>;

export function pluralCategory(locale: Locale, count: number): 'one' | 'other' {
  if (!Number.isFinite(count)) return 'other';
  const n = Math.abs(count);
  // French and Brazilian Portuguese treat 0 and 1 as singular; English and Spanish only 1.
  if (locale === 'fr' || locale === 'pt') return n === 0 || n === 1 ? 'one' : 'other';
  return n === 1 ? 'one' : 'other';
}

/** Finds the matching close brace for the open brace at `start`. */
function closeOf(text: string, start: number) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits "key1 {text1} key2 {text2}" into branches. */
function branches(body: string) {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i += 1;
    const open = body.indexOf('{', i);
    if (open === -1) break;
    const key = body.slice(i, open).trim();
    const close = closeOf(body, open);
    if (close === -1) break;
    out[key] = body.slice(open + 1, close);
    i = close + 1;
  }
  return out;
}

export function formatMessage(locale: Locale, message: string, values: MessageValues = {}): string {
  let out = '';
  let i = 0;
  while (i < message.length) {
    const open = message.indexOf('{', i);
    if (open === -1) {
      out += message.slice(i);
      break;
    }
    out += message.slice(i, open);
    const close = closeOf(message, open);
    if (close === -1) {
      out += message.slice(open);
      break;
    }
    const inner = message.slice(open + 1, close);
    const comma = inner.indexOf(',');
    if (comma === -1) {
      const value = values[inner.trim()];
      out += value === undefined || value === null ? `{${inner}}` : String(value);
    } else {
      const name = inner.slice(0, comma).trim();
      const rest = inner.slice(comma + 1);
      const comma2 = rest.indexOf(',');
      const kind = (comma2 === -1 ? rest : rest.slice(0, comma2)).trim();
      const body = comma2 === -1 ? '' : rest.slice(comma2 + 1);
      const options = branches(body);
      const raw = values[name];
      let chosen: string | undefined;
      if (kind === 'plural') {
        const count = Number(raw ?? 0);
        chosen = options[`=${count}`] ?? options[pluralCategory(locale, count)] ?? options.other;
        chosen = chosen === undefined ? undefined : chosen.replace(/#/g, formatCount(locale, count));
      } else if (kind === 'select') {
        chosen = options[String(raw ?? 'other')] ?? options.other;
      }
      out += chosen === undefined ? `{${inner}}` : formatMessage(locale, chosen, values);
    }
    i = close + 1;
  }
  return out;
}

function formatCount(locale: Locale, count: number) {
  try {
    return new Intl.NumberFormat(locale).format(count);
  } catch {
    return String(count);
  }
}
