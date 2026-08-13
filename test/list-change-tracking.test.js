'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    activeListValues,
    classifyExpectedListEvent,
    classifyHeaderActionObservation,
} = require('../build/lib/list-change-tracking');

const item = (id, value, completed = false) => ({ id, value, completed });
const baseline = [item('a', 'Milch'), item('b', 'Chips')];
const expected = activeListValues(baseline);

test('many own Alexa2 refreshes remain expected and need no follow-up run', () => {
    for (let index = 0; index < 100; index++) {
        assert.equal(classifyExpectedListEvent(baseline, expected), 'expected');
    }
    assert.equal(classifyExpectedListEvent(
        [item('a', 'ShoppingRoute Puffer abc 0'), item('b', 'Chips')],
        expected,
        { type: 'item', id: 'a', from: 'Milch', to: 'ShoppingRoute Puffer abc 0' },
    ), 'expected');
});

test('a genuine user addition or value change remains external', () => {
    assert.equal(classifyExpectedListEvent(baseline.concat(item('c', 'Cola')), expected), 'external');
    assert.equal(classifyExpectedListEvent([item('a', 'Extern geändert'), item('b', 'Chips')], expected), 'external');
});

test('only the expected managed header creation is absorbed', () => {
    const transition = { type: 'header-create', value: '---- ALDI ----' };
    assert.equal(classifyHeaderActionObservation(baseline, expected, transition), 'pending');
    assert.equal(
        classifyHeaderActionObservation(baseline.concat(item('h', '---- ALDI ----')), expected, transition),
        'confirmed',
    );
    assert.equal(
        classifyHeaderActionObservation(baseline.concat(item('x', 'Benutzereintrag')), expected, transition),
        'ambiguous',
    );
});

test('only removal of the selected managed header confirms deletion', () => {
    const withHeader = baseline.concat(item('h', '---- ALDI ----'));
    const headerValues = activeListValues(withHeader);
    const transition = { type: 'header-delete', id: 'h' };
    assert.equal(classifyHeaderActionObservation(withHeader, headerValues, transition), 'pending');
    assert.equal(classifyHeaderActionObservation(baseline, headerValues, transition), 'confirmed');
    assert.equal(
        classifyHeaderActionObservation([item('a', 'Milch')], headerValues, transition),
        'ambiguous',
    );

    const completedHeader = baseline.concat(item('old', '---- ALDI ----', true));
    const completedValues = activeListValues(completedHeader);
    assert.equal(
        classifyHeaderActionObservation(completedHeader, completedValues, { type: 'header-delete', id: 'old' }),
        'pending',
    );
    assert.equal(
        classifyHeaderActionObservation(baseline, completedValues, { type: 'header-delete', id: 'old' }),
        'confirmed',
    );
});
