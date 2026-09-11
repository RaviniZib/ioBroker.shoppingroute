import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, content) => fs.writeFileSync(path.join(root, rel), content);
const replaceOnce = (text, search, replacement, label) => {
    const first = text.indexOf(search);
    if (first < 0) throw new Error(`Lint-fix anchor not found: ${label}`);
    if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Lint-fix anchor is not unique: ${label}`);
    return text.slice(0, first) + replacement + text.slice(first + search.length);
};

let manual = read('src/lib/manual-order.ts');
manual = replaceOnce(
    manual,
    `const PREFIX = /^(?:\\d{2}>|\\[\\d{2}\\])\\s+(.+)$/s;
const norm = (value: unknown): string => String(value || '').trim().toLocaleLowerCase('de');
const visibleText = (value: unknown): string => {
    const text = String(value || '').trim();
`,
    `const PREFIX = /^(?:\\d{2}>|\\[\\d{2}\\])\\s+(.+)$/s;
function scalar(value: unknown): string {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
}
const norm = (value: unknown): string => scalar(value).trim().toLocaleLowerCase('de');
const visibleText = (value: unknown): string => {
    const text = scalar(value).trim();
`,
    'safe scalar helper',
);
manual = manual
    .replace("String(raw.listName || '').trim()", 'scalar(raw.listName).trim()')
    .replace("String(raw.itemId || '').trim()", 'scalar(raw.itemId).trim()')
    .replace("String(raw.originalText || '').trim()", 'scalar(raw.originalText).trim()')
    .replace("String(raw.market || '').trim()", 'scalar(raw.market).trim()')
    .replace("String(raw.updatedAt || '') || new Date(0).toISOString()", "scalar(raw.updatedAt) || new Date(0).toISOString()");
write('src/lib/manual-order.ts', manual);

let main = read('src/main.ts');
main = replaceOnce(
    main,
    "        const value = String(requested || '').trim();",
    "        const value = typeof requested === 'string' ? requested.trim() : '';",
    'configuredListName safe scalar',
);
write('src/main.ts', main);

console.log('Generated type/lint fixes applied.');
