// Verifies every locale has the same message keys and placeholders as English.
// Usage: node scripts/check-messages.mjs   (run from apps/mobile)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'src', 'i18n', 'messages');
const locales = readdirSync(root, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const parts = readdirSync(join(root, 'en')).filter((f) => f.endsWith('.json'));

function flatten(value, prefix = '', out = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object') flatten(child, path, out);
    else out[path] = child;
  }
  return out;
}

const placeholders = (text) =>
  String(text)
    .match(/\{[a-zA-Z]+(?:,[^}]*)?\}/g)
    ?.map((m) => m.replace(/,.*$/, '').replace(/\}$/, '}'))
    .sort() ?? [];

let problems = 0;
for (const part of parts) {
  const en = flatten(JSON.parse(readFileSync(join(root, 'en', part), 'utf8')));
  for (const locale of locales) {
    if (locale === 'en') continue;
    let other;
    try {
      other = flatten(JSON.parse(readFileSync(join(root, locale, part), 'utf8')));
    } catch {
      console.log(`${locale}/${part}: missing or invalid JSON`);
      problems += 1;
      continue;
    }
    for (const key of Object.keys(en)) {
      if (!(key in other)) {
        console.log(`${locale}/${part}: missing ${key}`);
        problems += 1;
      } else if (placeholders(en[key]).join() !== placeholders(other[key]).join()) {
        console.log(`${locale}/${part}: placeholders differ for ${key}`);
        problems += 1;
      }
    }
    for (const key of Object.keys(other)) {
      if (!(key in en)) {
        console.log(`${locale}/${part}: extra ${key}`);
        problems += 1;
      }
    }
  }
}

const total = parts.reduce((sum, part) => sum + Object.keys(flatten(JSON.parse(readFileSync(join(root, 'en', part), 'utf8')))).length, 0);
console.log(problems ? `${problems} problem(s) across ${total} keys` : `All ${locales.length} locales match (${total} keys, ${parts.length} parts)`);
process.exit(problems ? 1 : 0);
