'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);

function replaceOnce(content, find, replacement, label) {
    const index = content.indexOf(find);
    if (index < 0) throw new Error(`Missing replacement anchor: ${label}`);
    if (content.indexOf(find, index + find.length) >= 0) throw new Error(`Ambiguous replacement anchor: ${label}`);
    return content.slice(0, index) + replacement + content.slice(index + find.length);
}

// 1) Make market-header recognition tolerate the short en/em-dash format and nested sort prefixes.
{
    const file = 'src/lib/market-plan.ts';
    let source = read(file);
    source = replaceOnce(
        source,
        "const DASH_HEADER_PATTERN = /^----\\s+(.+?)\\s+----$/;\n",
        "const DASH_HEADER_PATTERN = /^----\\s+(.+?)\\s+----$/;\nconst SHORT_DASH_HEADER_PATTERN = /^[—–-]{1,5}\\s+(.+?)\\s+[—–-]{1,5}$/;\n\nfunction stripManagedPrefixes(value: string): string {\n    let text = String(value || '').trim();\n    for (let depth = 0; depth < 16; depth++) {\n        const match = text.match(/^(?:\\d{2}>|\\[\\d{2}\\])\\s+(.+)$/s);\n        if (!match?.[1]) break;\n        text = String(match[1]).trim();\n    }\n    return text;\n}\n",
        'market header patterns',
    );
    source = replaceOnce(
        source,
        "    const text = String(value || '').trim();\n    const match = text.match(HEADER_PATTERN) || text.match(STAR_HEADER_PATTERN) || text.match(DASH_HEADER_PATTERN);",
        "    const text = stripManagedPrefixes(value);\n    const match = text.match(HEADER_PATTERN) || text.match(STAR_HEADER_PATTERN) || text.match(DASH_HEADER_PATTERN) || text.match(SHORT_DASH_HEADER_PATTERN);",
        'marketNameFromHeader',
    );
    write(file, source);
}

// 2) Strip all nested ShoppingRoute prefixes, not just the outermost one.
{
    const file = 'src/lib/prefix-sort.ts';
    let source = read(file);
    source = replaceOnce(
        source,
        "export function stripSortPrefix(text: string): string {\n    return parseSortPrefix(text)?.originalText ?? String(text || '').trim();\n}",
        "export function stripSortPrefix(text: string): string {\n    let value = String(text || '').trim();\n    for (let depth = 0; depth < 16; depth++) {\n        const parsed = parseSortPrefix(value);\n        if (!parsed) break;\n        value = parsed.originalText;\n    }\n    return value;\n}",
        'recursive stripSortPrefix',
    );
    write(file, source);
}

// 3) Replace the unreliable sendTo/useNative review control with the real draft editor.
{
    const file = 'admin/jsonConfig.json';
    const config = JSON.parse(read(file));
    const items = config.items.reviewTab.items;
    if (!items.reviewItems) throw new Error('reviewItems config missing');
    delete items.reviewAcceptAll;
    items.reviewEditor = {
        type: 'custom',
        url: 'custom/routeEditor.js',
        name: 'ShoppingRouteAdminSet/Components/ReviewEditor',
        guiApi: 2,
        i18n: false,
        xs: 12,
        sm: 12,
        md: 12,
        lg: 12,
        xl: 12,
    };
    items.reviewItems.hidden = 'true';
    config.items.reviewTab.items = {
        reviewSectionTitle: items.reviewSectionTitle,
        reviewHelp: items.reviewHelp,
        reviewEditor: items.reviewEditor,
        reviewItems: items.reviewItems,
    };
    write(file, `${JSON.stringify(config, null, 2)}\n`);
}

// 4) Hide empty market columns; moving into an empty market remains available from each item's market selector.
{
    const file = 'src-admin/shopping-list-editor.js';
    let source = read(file);
    source = replaceOnce(
        source,
        "        const columns = view.markets.map(market => {",
        "        const visibleMarkets = view.markets.filter(market => items.some(item => item.market === market));\n        if (!visibleMarkets.length) {\n            children.push(h('div', { key: 'empty-list', style: { opacity: 0.7, padding: '16px 0' } }, text('Die Einkaufsliste ist leer.', 'The shopping list is empty.')));\n            return h('div', { style: { width: '100%' } }, children);\n        }\n        const columns = visibleMarkets.map(market => {",
        'hide empty market columns',
    );
    write(file, source);
}

// 5) Regression tests for the exact bugs reported from the real Admin UI.
{
    const file = 'test/prefix-sort.test.js';
    let source = read(file);
    source = replaceOnce(
        source,
        "    assert.equal(stripSortPrefix('25> Tomaten'), 'Tomaten');\n    assert.equal(stripSortPrefix('Tomaten'), 'Tomaten');",
        "    assert.equal(stripSortPrefix('25> Tomaten'), 'Tomaten');\n    assert.equal(stripSortPrefix('14> 25> Tomaten'), 'Tomaten');\n    assert.equal(stripSortPrefix('[14] 25> Tomaten'), 'Tomaten');\n    assert.equal(stripSortPrefix('Tomaten'), 'Tomaten');",
        'recursive prefix tests',
    );
    source = replaceOnce(
        source,
        "    assert.equal(marketNameFromHeader('---- ALDI ----', markets), 'ALDI');",
        "    assert.equal(marketNameFromHeader('---- ALDI ----', markets), 'ALDI');\n    assert.equal(marketNameFromHeader('— ALDI —', markets), 'ALDI');\n    assert.equal(marketNameFromHeader('25> — ALDI —', markets), 'ALDI');\n    assert.equal(marketNameFromHeader('14> 25> — ALDI —', markets), 'ALDI');",
        'short dash header tests',
    );
    write(file, source);
}

{
    const file = 'test/review-accept-all.test.js';
    write(file, `'use strict';\n\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst fs = require('node:fs');\nconst path = require('node:path');\n\nconst root = path.join(__dirname, '..');\nconst config = JSON.parse(fs.readFileSync(path.join(root, 'admin/jsonConfig.json'), 'utf8'));\nconst { ReviewEditorModel: model } = require('../src-admin/review-editor');\n\ntest('review uses a direct Admin draft editor instead of sendTo/useNative', () => {\n    const review = config.items.reviewTab.items;\n    assert.equal(review.reviewAcceptAll, undefined);\n    assert.equal(review.reviewEditor.type, 'custom');\n    assert.equal(review.reviewEditor.url, 'custom/routeEditor.js');\n    assert.equal(review.reviewEditor.name, 'ShoppingRouteAdminSet/Components/ReviewEditor');\n    assert.equal(review.reviewEditor.guiApi, 2);\n    assert.equal(review.reviewItems.hidden, 'true');\n});\n\ntest('accept immediately updates the catalogue and visible status in the same Admin draft', () => {\n    const data = {\n        products: [],\n        reviewItems: [{\n            key: 'schmelzkaese',\n            product: 'Schmelzkäse',\n            text: 'Schmelzkäse',\n            guessedCategory: 'Milchprodukte',\n            category: 'Milchprodukte',\n            defaultMarket: 'LIDL',\n            availableMarkets: ['LIDL', 'REWE'],\n            aliases: '',\n            action: 'pending',\n        }],\n    };\n    const result = model.acceptReviewRows(data, [0]);\n    assert.equal(result.reviewItems[0].action, 'accepted');\n    assert.equal(result.reviewItems[0].availableMarkets, 'LIDL,REWE');\n    assert.deepEqual(result.products, [{\n        name: 'Schmelzkäse',\n        aliases: '',\n        category: 'Milchprodukte',\n        defaultMarket: 'LIDL',\n        availableMarkets: 'LIDL,REWE',\n    }]);\n    assert.equal(data.reviewItems[0].action, 'pending', 'source draft remains immutable');\n});\n\ntest('accepting an already-known article updates it without creating a duplicate', () => {\n    const data = {\n        products: [{ name: 'Zucchini', aliases: '', category: 'Sonstiges', defaultMarket: '', availableMarkets: '' }],\n        reviewItems: [{ product: 'Zucchini', category: 'Obst/Gemüse', defaultMarket: 'LIDL', availableMarkets: 'LIDL', aliases: 'Zucchino', action: 'pending' }],\n    };\n    const result = model.acceptReviewRows(data, [0]);\n    assert.equal(result.products.length, 1);\n    assert.equal(result.products[0].category, 'Obst/Gemüse');\n    assert.equal(result.products[0].defaultMarket, 'LIDL');\n    assert.equal(result.products[0].aliases, 'Zucchino');\n    assert.equal(result.reviewItems[0].action, 'accepted');\n});\n`);
}

{
    const file = 'test/shopping-list-ui-fixes.test.js';
    write(file, `'use strict';\n\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { ShoppingListEditorModel: model } = require('../src-admin/shopping-list-editor');\n\ntest('shopping list display strips nested internal prefixes', () => {\n    assert.equal(model.stripVisiblePrefix('14> 25> Weggummis'), 'Weggummis');\n    assert.equal(model.stripVisiblePrefix('[14] 25> Veganes Hack'), 'Veganes Hack');\n});\n\ntest('legacy short market headers never appear as shopping items', () => {\n    const view = {\n        markets: ['LIDL', 'REWE'],\n        items: [\n            { id: 'h', text: '14> — LIDL —', market: 'LIDL' },\n            { id: 'a', text: '20> Weggummis', market: 'LIDL' },\n        ],\n    };\n    assert.equal(model.headerMarket('14> — LIDL —', view.markets), 'LIDL');\n    assert.deepEqual(model.visibleItems(view).map(item => item.text), ['Weggummis']);\n});\n`);
}

{
    const file = 'test/review-header-filter.test.js';
    write(file, `'use strict';\n\nconst test = require('node:test');\nconst assert = require('node:assert/strict');\nconst { collectUnknownItems } = require('../build/lib/sorter');\n\nconst markets = [{ name: 'LIDL', enabled: true }, { name: 'REWE', enabled: true }];\nconst item = (id, value) => ({ id, value, completed: false, version: 1 });\n\ntest('legacy short market headings never enter the review queue', () => {\n    const unknown = collectUnknownItems([\n        item('h1', '— LIDL —'),\n        item('h2', '14> — REWE —'),\n        item('h3', '14> 25> — LIDL —'),\n        item('a', 'Schmelzkäse'),\n    ], markets, [], 'LIDL');\n    assert.deepEqual(unknown.map(entry => entry.product), ['Schmelzkäse']);\n});\n`);
}

// 6) Update Admin regression tests to describe the new review editor contract.
{
    const file = 'test/admin-config.test.js';
    let source = read(file);
    source = source.replace(
        "  assert.equal(jsonConfig.items.reviewTab.items.reviewAcceptAll.variant,'outlined');\n",
        "  assert.equal(jsonConfig.items.reviewTab.items.reviewEditor.type,'custom');\n",
    );
    const oldBlock = `  const review=jsonConfig.items.reviewTab.items;\n  assert.equal(review._reviewEditorRows,undefined);\n  assert.notEqual(review.reviewItems.hidden,'true');\n  const rAlternatives=review.reviewItems.items.find(x=>x.attr==='availableMarkets');\n  assert.equal(rAlternatives.multiple,true);\n  assert.equal(rAlternatives.defaultSendTo,'normalizeMarketSelection');\n  assert.match(rAlternatives.jsonData,/globalData\\.markets/);\n\n  const reviewCalc=new Function('data',\`return \${review.reviewItems.onChange.calculateFunc}\`);\n  const serializedReviews=reviewCalc({\n    reviewItems:[{product:'Milch',availableMarkets:['REWE','LIDL']}],\n  });\n  assert.equal(serializedReviews[0].availableMarkets,'REWE,LIDL');\n\n  assert.match(review.reviewAcceptAll.jsonData,/JSON\\.stringify\\(data\\)/);\n  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');\n  assert.match(source,/normalizeMarketSelection/);`;
    const newBlock = `  const review=jsonConfig.items.reviewTab.items;\n  assert.equal(review._reviewEditorRows,undefined);\n  assert.equal(review.reviewEditor.type,'custom');\n  assert.equal(review.reviewEditor.url,'custom/routeEditor.js');\n  assert.equal(review.reviewEditor.name,'ShoppingRouteAdminSet/Components/ReviewEditor');\n  assert.equal(review.reviewEditor.guiApi,2);\n  assert.equal(review.reviewItems.hidden,'true');\n  const rAlternatives=review.reviewItems.items.find(x=>x.attr==='availableMarkets');\n  assert.equal(rAlternatives.multiple,true);\n  assert.equal(rAlternatives.defaultSendTo,'normalizeMarketSelection');\n  assert.match(rAlternatives.jsonData,/globalData\\.markets/);\n  assert.ok(fs.existsSync(path.join(root,'src-admin','review-editor.js')));\n  const reviewSource=fs.readFileSync(path.join(root,'src-admin','review-editor.js'),'utf8');\n  assert.match(reviewSource,/acceptReviewRows/);\n  assert.match(reviewSource,/action: 'accepted'/);\n\n  const source=fs.readFileSync(path.join(root,'src','main.ts'),'utf8');\n  assert.match(source,/normalizeMarketSelection/);`;
    source = replaceOnce(source, oldBlock, newBlock, 'admin review editor test block');

    // Recalculate the intentionally changed functional-config snapshot hash.
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
    if (source.includes('reviewAcceptAll')) throw new Error('stale reviewAcceptAll test reference remains');
    write(file, source);
}

// 7) The shared Federation remote now intentionally exposes both Admin components.
{
    const file = 'test/route-editor.test.js';
    let source = read(file);
    source = replaceOnce(
        source,
        "      components: ['RouteEditor'],",
        "      components: ['ReviewEditor', 'RouteEditor'],",
        'route remote component list',
    );
    write(file, source);
}

console.log('0.3.8 source/config regression fix prepared.');
