'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(content, find, replacement, label) {
    const index = content.indexOf(find);
    if (index < 0) {
        throw new Error(`Missing replacement anchor: ${label}`);
    }
    if (content.indexOf(find, index + find.length) >= 0) {
        throw new Error(`Ambiguous replacement anchor: ${label}`);
    }
    return content.slice(0, index) + replacement + content.slice(index + find.length);
}

// Keep the existing walking-route remote single-purpose.
write(
    'src-admin/route-editor-components.mjs',
    "import routeEditor from './route-editor.js';\n\nexport default routeEditor.Components;\n",
);

// Give the review editor a dedicated Module Federation remote/manifest.
write(
    'src-admin/review-editor-components.mjs',
    "import reviewEditor from './review-editor.js';\n\nexport default reviewEditor.Components;\n",
);

write(
    'vite.review.config.mjs',
    `import { resolve } from 'node:path';\n\nimport { federation } from '@module-federation/vite';\nimport commonjs from 'vite-plugin-commonjs';\n\nexport default {\n    plugins: [\n        federation({\n            manifest: true,\n            name: 'ShoppingRouteReviewSet',\n            filename: 'reviewEditor.js',\n            exposes: {\n                './Components': './src-admin/review-editor-components.mjs',\n            },\n            remotes: {},\n            dts: false,\n            shared: {\n                react: {\n                    singleton: true,\n                    requiredVersion: '>=18',\n                },\n            },\n        }),\n        commonjs(),\n    ],\n    base: './',\n    build: {\n        target: 'chrome89',\n        outDir: 'admin/custom/review',\n        emptyOutDir: true,\n        rollupOptions: {\n            input: resolve('src-admin/review-editor-components.mjs'),\n        },\n    },\n};\n`,
);

{
    const file = 'scripts/build-admin.js';
    let source = read(file);
    const anchor = `    {\n        config: 'vite.shopping-list.config.mjs',\n        directory: 'shoppingList',\n        name: 'ShoppingRouteShoppingListSet',\n        remoteEntry: 'shoppingListEditor.js',\n    },`;
    const replacement = `    {\n        config: 'vite.review.config.mjs',\n        directory: 'review',\n        name: 'ShoppingRouteReviewSet',\n        remoteEntry: 'reviewEditor.js',\n    },\n${anchor}`;
    source = replaceOnce(source, anchor, replacement, 'review Admin build');
    write(file, source);
}

{
    const file = 'admin/jsonConfig.json';
    const config = JSON.parse(read(file));
    const editor = config.items?.reviewTab?.items?.reviewEditor;
    if (!editor) {
        throw new Error('reviewEditor config missing');
    }
    editor.url = 'custom/review/reviewEditor.js';
    editor.name = 'ShoppingRouteReviewSet/Components/ReviewEditor';
    write(file, `${JSON.stringify(config, null, 2)}\n`);
}

{
    const file = 'src-admin/shopping-list-editor.js';
    let source = read(file);
    source = replaceOnce(
        source,
        '@media(max-width:700px){',
        '@media (max-width: 600px) {',
        'shopping list 600px breakpoint',
    );
    write(file, source);
}

{
    const file = 'test/review-accept-all.test.js';
    let source = read(file);
    source = source
        .replace("assert.equal(review.reviewEditor.url, 'custom/routeEditor.js');", "assert.equal(review.reviewEditor.url, 'custom/review/reviewEditor.js');")
        .replace("assert.equal(review.reviewEditor.name, 'ShoppingRouteAdminSet/Components/ReviewEditor');", "assert.equal(review.reviewEditor.name, 'ShoppingRouteReviewSet/Components/ReviewEditor');");
    write(file, source);
}

{
    const file = 'test/admin8-custom-components.test.js';
    let source = read(file);
    source = replaceOnce(
        source,
        `            'custom/productGroups/productGroupsEditor.js',\n            'custom/routeEditor.js',`,
        `            'custom/productGroups/productGroupsEditor.js',\n            'custom/review/reviewEditor.js',\n            'custom/routeEditor.js',`,
        'custom component URL list',
    );
    source = replaceOnce(
        source,
        `        ['vite.product-groups.config.mjs', 'admin/custom/productGroups'],\n        ['vite.shopping-list.config.mjs', 'admin/custom/shoppingList'],`,
        `        ['vite.product-groups.config.mjs', 'admin/custom/productGroups'],\n        ['vite.review.config.mjs', 'admin/custom/review'],\n        ['vite.shopping-list.config.mjs', 'admin/custom/shoppingList'],`,
        'custom component Vite configs',
    );
    write(file, source);
}

{
    const file = 'test/admin-config.test.js';
    let source = read(file);
    source = source
        .replace("assert.equal(review.reviewEditor.url,'custom/routeEditor.js');", "assert.equal(review.reviewEditor.url,'custom/review/reviewEditor.js');")
        .replace("assert.equal(review.reviewEditor.name,'ShoppingRouteAdminSet/Components/ReviewEditor');", "assert.equal(review.reviewEditor.name,'ShoppingRouteReviewSet/Components/ReviewEditor');");

    // The functional configuration hash must be computed after the final review-remote URL/name are in place.
    const config = JSON.parse(read('admin/jsonConfig.json'));
    const visualProperties = new Set([
        'label','text','title','width','style','darkStyle','innerStyle','controlStyle',
        'xs','sm','md','lg','xl','newLine','variant','icon','iconPosition','boxType',
        'closeable','size','help','tooltip','placeholder',
    ]);
    const presentationTypes = new Set(['header','staticText','infoBox','divider']);
    const stripVisualProperties = value => {
        if (Array.isArray(value)) return value.map(stripVisualProperties);
        if (!value || typeof value !== 'object') return value;
        return Object.fromEntries(Object.entries(value)
            .filter(([key]) => !visualProperties.has(key))
            .map(([key, item]) => [key, stripVisualProperties(item)]));
    };
    const panels = ['general','listsTab','routesTab','productsTab','reviewTab','transferTab'];
    const projection = Object.fromEntries(panels.map(panel => [
        panel,
        Object.fromEntries(Object.entries(config.items[panel].items)
            .filter(([, item]) => !presentationTypes.has(item.type))
            .map(([key, item]) => [key, stripVisualProperties(item)])),
    ]));
    const hash = crypto.createHash('sha256').update(JSON.stringify(projection)).digest('hex');
    source = source.replace(/assert\.equal\(hash,'[a-f0-9]{64}'\);/, `assert.equal(hash,'${hash}');`);
    write(file, source);
}

{
    const file = 'test/route-editor.test.js';
    let source = read(file);
    source = source.replace("components: ['ReviewEditor', 'RouteEditor'],", "components: ['RouteEditor'],");
    write(file, source);
}

console.log('Dedicated review Admin remote and final protection pins prepared.');
