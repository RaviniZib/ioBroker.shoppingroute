'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Components: { ReviewEditor } } = require('../src-admin/review-editor');

function elements(tree) {
    if (!tree || typeof tree !== 'object') return [];
    return [tree, ...[tree.props?.children].flat(Infinity).flatMap(elements)];
}

function mountEditor() {
    const data = {
        products: [],
        markets: ['ALDI', 'LIDL', 'REWE'].map(name => ({ name })),
        reviewItems: [{ key: 'probe', product: 'Probe', category: 'Sonstiges',
            defaultMarket: 'LIDL', availableMarkets: 'Alter Markt', action: 'pending' }],
    };
    const editor = new ReviewEditor({ data, onChange: next => { editor.props = { ...editor.props, data: next }; } });
    return editor;
}

function toggle(editor, market, checked) {
    const label = elements(editor.render()).find(node => node.type === 'label' &&
        elements(node).some(child => child.type === 'span' && child.props.children === market));
    assert.ok(label, `market ${market} is visible`);
    const checkbox = elements(label).find(node => node.type === 'input');
    assert.equal(checkbox.props.type, 'checkbox');
    checkbox.props.onChange({ target: { checked } });
}

for (const bulk of [false, true]) {
    test(`market controls retain independent selections through ${bulk ? 'accept all' : 'accept'}`, () => {
        const editor = mountEditor();
        for (const market of ['ALDI', 'LIDL', 'REWE']) toggle(editor, market, true);
        toggle(editor, 'LIDL', false);
        assert.deepEqual(editor.props.data.reviewItems[0].availableMarkets, ['Alter Markt', 'ALDI', 'REWE']);
        toggle(editor, 'LIDL', true);
        const expected = ['Alter Markt', 'ALDI', 'REWE', 'LIDL'];
        assert.deepEqual(editor.props.data.reviewItems[0].availableMarkets, expected);
        assert.equal(editor.props.data.reviewItems[0].defaultMarket, 'LIDL');
        const originalDraft = editor.props.data;
        const rendered = elements(editor.render());
        if (bulk) rendered.find(node => node.type === 'button' && node.key === 'acceptAll').props.onClick();
        else rendered.find(node => node.type === 'select' && node.key === 'action').props.onChange({target: {value: 'accept'}});
        const saved = JSON.parse(JSON.stringify(editor.props.data));
        assert.equal(saved.products.length, 1);
        assert.deepEqual(saved.products[0].availableMarkets, expected);
        assert.deepEqual(saved.reviewItems, []);
        assert.equal(elements(editor.render()).filter(node => node.props?.className === 'shoppingroute-review-row').length, 0);
        // Discard/reload is controlled by the Admin host; the original must remain untouched.
        editor.props = { ...editor.props, data: originalDraft };
        assert.equal(editor.props.data.reviewItems.length, 1);
        assert.equal(editor.props.data.products.length, 0);
        toggle(editor, 'Alter Markt', false);
        assert.deepEqual(editor.props.data.reviewItems[0].availableMarkets, ['ALDI', 'REWE', 'LIDL']);
    });
}


test('individual acceptance retains other rows and blank products for correction', () => {
    const editor = mountEditor();
    editor.props.data.reviewItems.push({key: 'second', product: 'Other', action: 'pending'}, {key: 'blank', product: ' ', action: 'pending'});
    editor.accept(0);
    assert.deepEqual(editor.props.data.reviewItems.map(row => row.key), ['second', 'blank']);
    editor.acceptAll();
    assert.deepEqual(editor.props.data.reviewItems.map(row => row.key), ['blank']);
    assert.equal(editor.props.data.products.length, 2);
});
