'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin/backup-transfer.html'), 'utf8');
const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const localization = fs.readFileSync(path.join(root, 'admin/backup-i18n.js'), 'utf8');
const languages = ['en', 'de', 'ru', 'pt', 'nl', 'fr', 'it', 'es', 'pl', 'uk', 'zh-cn'];
const tick = () => new Promise(resolve => setImmediate(resolve));

function page(language, search = '?instance=shoppingroute.0') {
    const nodes = new Map();
    const writes = [];
    const element = () => ({ textContent: '', options: [{}], handlers: {}, appendChild() {},
        addEventListener(type, handler) { this.handlers[type] = handler; } });
    const document = { documentElement: {}, getElementById(id) {
        if (!nodes.has(id)) nodes.set(id, element());
        return nodes.get(id);
    }, createElement: element };
    const socket = { on() {}, emit(type, ...args) {
        const done = args.at(-1);
        if (type === 'setState') { writes.push({ id: args[0], value: args[1].val }); done(null); }
    } };
    const window = { location: { search, origin: 'http://localhost' }, io: { connect: () => socket }, setTimeout() {} };
    const context = vm.createContext({ window, document, navigator: { language }, URLSearchParams, console });
    vm.runInContext(localization, context);
    vm.runInContext(script, context);
    return { nodes, writes, document, i18n: window.ShoppingRouteBackupI18n };
}

test('backup utility translates all controls, document metadata and errors in all 11 languages', async () => {
    const expected = Object.keys(page('en', '').i18n.translations.en).sort();
    for (const language of languages) {
        const { nodes, document, i18n } = page(language, '');
        const texts = i18n.translations[language];
        assert.deepEqual(Object.keys(texts).sort(), expected, language);
        for (const [key, value] of Object.entries(texts)) assert.ok(value.trim(), `${language}:${key}`);
        assert.equal(document.documentElement.lang, language);
        assert.equal(document.title, texts.title);
        assert.equal(nodes.get('status').textContent, texts.noInstance);
        assert.equal(nodes.get('marketSelect').options[0].textContent, texts.loading);
        for (const id of ['configTitle', 'configText', 'downloadConfig', 'uploadConfig', 'marketTitle', 'marketText', 'downloadMarket', 'uploadMarket']) {
            assert.equal(nodes.get(id).textContent, texts[id], `${language}:${id}`);
        }
        const live = page(language);
        for (const [id, key] of [['configFile', 'invalidBackup'], ['marketFile', 'invalidProfile']]) {
            await live.nodes.get(id).handlers.change({ target: { files: [{ text: async () => '[]' }] } });
            assert.equal(live.nodes.get('status').textContent, texts[key]);
        }
    }
});

test('backup locale selection handles regional variants, explicit language and unsupported locales', () => {
    for (const [locale, expected] of [['de-DE', 'de'], ['pt_BR', 'pt'], ['fr-CA', 'fr'], ['zh-Hans-CN', 'zh-cn'], ['zh-TW', 'zh-cn'], ['sv-SE', 'en'], ['constructor', 'en'], ['', 'en']]) {
        assert.equal(page(locale, '').document.documentElement.lang, expected);
    }
    assert.equal(page('de-DE', '?lang=uk').document.documentElement.lang, 'uk');
});

test('translated backup page sends existing German config and market profiles without renaming user data', async () => {
    const config = JSON.stringify({ fallbackMarket: 'Ohne Markt', markets: [{ name: 'Ohne Markt' }], products: [{ name: 'Milch', category: 'Milchprodukte' }], routes: [{ market: 'Ohne Markt', category: 'Milchprodukte', order: 10 }] });
    const profile = JSON.stringify({ format: 'shoppingroute-market-profile-v1', market: { name: 'Ohne Markt' }, route: [{ category: 'Obst/Gemüse', order: 10 }] });
    for (const language of languages) {
        const { nodes, writes } = page(language);
        await nodes.get('configFile').handlers.change({ target: { files: [{ text: async () => config }] } });
        await nodes.get('marketFile').handlers.change({ target: { files: [{ text: async () => profile }] } });
        assert.deepEqual(writes, [
            { id: 'shoppingroute.0.control.importConfigJson', value: config },
            { id: 'shoppingroute.0.control.marketProfileImport', value: profile },
        ]);
    }
    await tick();
});
