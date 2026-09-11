import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const write = (rel, content) => fs.writeFileSync(path.join(root, rel), content);
const replaceOnce = (text, search, replacement, label) => {
    const first = text.indexOf(search);
    if (first < 0) throw new Error(`Test-fix anchor not found: ${label}`);
    if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Test-fix anchor is not unique: ${label}`);
    return text.slice(0, first) + replacement + text.slice(first + search.length);
};
const sha256 = rel => crypto.createHash('sha256').update(read(rel).replace(/\r\n?/g, '\n')).digest('hex');
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

let adminConfigTest = read('test/admin-config.test.js');
adminConfigTest = replaceOnce(
    adminConfigTest,
    "assert.equal(hash,'e7a68ae2fa469d8a3c23b7b603cbc09db125cce1c2868150e5eca73fc33345ac');",
    "assert.equal(hash,'cd07bb3ff1c703b45024eaf754da5264d2b6c0541c6a24f3156688478dc3d795');",
    'intentional functional JSON config hash',
);
write('test/admin-config.test.js', adminConfigTest);

let admin8 = read('test/admin8-custom-components.test.js');
admin8 = replaceOnce(
    admin8,
    `            'custom/productGroups/productGroupsEditor.js',
            'custom/routeEditor.js',
`,
    `            'custom/productGroups/productGroupsEditor.js',
            'custom/routeEditor.js',
            'custom/shoppingList/shoppingListEditor.js',
`,
    'custom component inventory',
);
admin8 = replaceOnce(
    admin8,
    `        ['vite.markets.config.mjs', 'admin/custom/markets'],
        ['vite.product-groups.config.mjs', 'admin/custom/productGroups'],
`,
    `        ['vite.markets.config.mjs', 'admin/custom/markets'],
        ['vite.product-groups.config.mjs', 'admin/custom/productGroups'],
        ['vite.shopping-list.config.mjs', 'admin/custom/shoppingList'],
`,
    'custom Vite config inventory',
);
write('test/admin8-custom-components.test.js', admin8);

let shoppingListTest = read('test/shopping-list-admin.test.js');
shoppingListTest = shoppingListTest.replaceAll(
    '/@media (max-width: 600px)/',
    '/@media \\(max-width: 600px\\)/',
);
write('test/shopping-list-admin.test.js', shoppingListTest);

let routePins = read('test/product-groups-editor.test.js');
for (const rel of [
    'src-admin/route-editor.js',
    'src-admin/route-editor-components.mjs',
    'admin/custom/routeEditor.js',
    'admin/custom/mf-manifest.json',
]) {
    const pattern = new RegExp(`('${escapeRegExp(rel)}':\\s*')[0-9a-f]{64}(')`);
    if (!pattern.test(routePins)) throw new Error(`Route checksum pin not found for ${rel}`);
    routePins = routePins.replace(pattern, `$1${sha256(rel)}$2`);
}
write('test/product-groups-editor.test.js', routePins);

console.log('Intentional 0.3.7 Admin regression tests refreshed.');
