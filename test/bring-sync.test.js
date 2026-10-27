'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseBringContent, parseAlexaContent, indexBridgeItems, reconcileBring,
    itemKey, itemsMatchExpected, parseBridgeBaseline, serializeBridgeBaseline, bringSyncLogEvent,
    pendingWritesConfirmedExceptConcurrent,
} = require('../build/lib/bring-sync');

const markets = [{ name: 'ALDI' }, { name: 'REWE' }];
function b(name, specification = '') {
    return parseBringContent([{ name, specification }])[0];
}
function a(id, value, version = 3) {
    return parseAlexaContent([{ id, value, version, completed: false }], markets)[0];
}
function baseline(bring, alexa, mode = 'bidirectional') {
    return { version: 1, scope: 'test', mode,
        bring: bring.map(entry => entry.key), alexa: alexa.map(entry => entry.key) };
}

test('Bring JSON is read with names and specifications intact', () => {
    const parsed = parseBringContent('[{"name":"Gnocchi","specification":"500 g, aus dem Kühlregal"}]');
    assert.equal(parsed[0].text, 'Gnocchi, 500 g, aus dem Kühlregal');
    assert.equal(parsed[0].name, 'Gnocchi');
    assert.equal(parsed[0].specification, '500 g, aus dem Kühlregal');
    assert.equal(itemKey(' MILCH  '), itemKey('milch'));
    assert.throws(() => parseBringContent('{}'), /not a JSON array/);
});

test('Alexa snapshots omit ShoppingRoute market headers and mobile commands', () => {
    const items = [
        { id: 'm', value: '25> Milch, 2 Packungen', version: 4, completed: false },
        { id: 'h', value: '03> ═════ ALDI ═════', version: 2, completed: false },
        { id: 'c', value: '25WREWE', version: 2, completed: false },
        { id: 'done', value: '22> Butter', version: 2, completed: true },
    ];
    const result = parseAlexaContent(items, markets);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Milch');
    assert.equal(result[0].specification, '2 Packungen');
    assert.equal(result[0].alexaId, 'm');
});

test('initial bidirectional sync is an additive union; never deletes existing entries', () => {
    const plan = reconcileBring('bidirectional', null, [b('Äpfel'), b('Bananen')], [a('a', '55> Milch')]);
    assert.deepEqual(plan.addToAlexa.map(entry => entry.name).sort(), ['Bananen', 'Äpfel'].sort());
    assert.deepEqual(plan.addToBring.map(entry => entry.name), ['Milch']);
    assert.equal(plan.removeFromAlexa.length, 0);
    assert.equal(plan.removeFromBring.length, 0);
});

test('initial one-way import preserves Alexa-only entries', () => {
    const plan = reconcileBring('import', null, [b('Salami')], [a('x', '22> Käse')]);
    assert.deepEqual(plan.addToAlexa.map(x => x.name), ['Salami']);
    assert.equal(plan.addToBring.length, 0);
    assert.equal(plan.removeFromAlexa.length, 0);
});

test('Bring addition is transferred to Alexa after the baseline', () => {
    const old = [b('Milch')];
    const plan = reconcileBring('bidirectional', baseline(old, old), [...old, b('Butter')], [...old]);
    assert.deepEqual(plan.addToAlexa.map(x => x.name), ['Butter']);
    assert.equal(plan.addToBring.length, 0);
});

test('Alexa addition is transferred to Bring! after the baseline', () => {
    const old = [b('Milch')];
    const plan = reconcileBring('bidirectional', baseline(old, old), old, [a('a', '50> Milch'), a('z', '80> Eier')]);
    assert.deepEqual(plan.addToBring.map(x => x.name), ['Eier']);
});

test('Bring completion removes the counterpart from Alexa in two-way mode', () => {
    const old = [b('Milch')];
    const plan = reconcileBring('bidirectional', baseline(old, old), [], [a('z', '34> Milch', 7)]);
    assert.deepEqual(plan.removeFromAlexa.map(x => [x.name, x.alexaId, x.alexaVersion]), [['Milch', 'z', 7]]);
});

test('Alexa completion moves the counterpart to Bring! recently used', () => {
    const old = [b('Milch')];
    const plan = reconcileBring('bidirectional', baseline(old, old), old, []);
    assert.deepEqual(plan.removeFromBring.map(x => x.name), ['Milch']);
});

test('one-way Bring completion removes only items already present in its baseline', () => {
    const oldB = [b('Milch')];
    const oldA = [...oldB, b('Alexa-only')];
    const plan = reconcileBring('import', baseline(oldB, oldA, 'import'), [], oldA);
    assert.deepEqual(plan.removeFromAlexa.map(x => x.name), ['Milch']);
    assert.equal(plan.removeFromBring.length, 0);
});

test('two independent simultaneous additions merge on both sides', () => {
    const base = baseline([], []);
    const plan = reconcileBring('bidirectional', base, [b('Milch')], [a('a', '25> Zucker')]);
    assert.deepEqual(plan.addToAlexa.map(x => x.name), ['Milch']);
    assert.deepEqual(plan.addToBring.map(x => x.name), ['Zucker']);
});

test('duplicate product names and conflicting specifications stop instead of guessing', () => {
    assert.throws(() => indexBridgeItems([b('Milch'), b('MILCH')], 'Bring!'), /duplicate/);
    assert.throws(() => reconcileBring('bidirectional', null,
        [b('Käse', '500 g')], [a('a', '10> Käse, 1 kg')]), /Conflicting specifications/);
});

test('provider snapshots must exactly match the persisted expected state', () => {
    const items = [b('Milch')];
    assert.equal(itemsMatchExpected(items, [items[0].key]), true);
    assert.equal(itemsMatchExpected([], [items[0].key]), false);
    const journal = baseline(items, items);
    const parsed = parseBridgeBaseline(serializeBridgeBaseline(journal));
    assert.deepEqual(parsed, journal);
    assert.throws(() => parseBridgeBaseline('{"version":1,"scope":1}'), /Invalid Bring/);
    assert.equal(parseBridgeBaseline('{}'), null);
});

test('a pending journal survives serialization and blocks re-planning', () => {
    const old = [b('Milch')];
    const journal = baseline(old, old);
    journal.pending = { createdAt: new Date().toISOString(), bring: [old[0].key], alexa: [old[0].key] };
    const restored = parseBridgeBaseline(serializeBridgeBaseline(journal));
    assert.deepEqual(restored.pending, journal.pending);
    assert.throws(() => reconcileBring('bidirectional', restored, old, old), /Pending/);
});

test('Alexa voice-added milk syncs to Bring! and Bring! completion clears the active Alexa copy', () => {
    const voiceAdded = [a('voice-milk', '12> Milch', 7)];
    const importPlan = reconcileBring('bidirectional', baseline([], []), [], voiceAdded);
    assert.deepEqual(importPlan.addToBring.map(entry => entry.text), ['Milch']);
    assert.deepEqual(importPlan.removeFromAlexa, []);

    const mirrored = [b('Milch')];
    const completionPlan = reconcileBring('bidirectional', baseline(mirrored, voiceAdded), [], voiceAdded);
    assert.deepEqual(completionPlan.removeFromAlexa.map(entry => [entry.alexaId, entry.alexaVersion]), [['voice-milk', 7]]);
    assert.deepEqual(completionPlan.addToBring, []);
});

test('one-way Bring import does not transfer an Alexa voice addition into Bring!', () => {
    const voiceAdded = [a('voice-milk', '12> Milch')];
    const plan = reconcileBring('import', baseline([], [], 'import'), [], voiceAdded);
    assert.deepEqual(plan.addToBring, []);
    assert.deepEqual(plan.removeFromAlexa, []);
});

test('Bring! bridge stays quiet during normal polling, then warns once after three minutes', () => {
    const since = '2026-10-27T08:00:00.000Z';
    const now = Date.parse(since);
    assert.equal(bringSyncLogEvent('synced', 'No changes needed.', null, undefined, now), null);
    assert.equal(bringSyncLogEvent('verifying', 'Waiting', null, since, now + 179_999), null);
    const warning = bringSyncLogEvent('verifying', 'Waiting', null, since, now + 180_000);
    assert.equal(warning.level, 'warn');
    assert.match(warning.message, /Bestätigung/);
    assert.equal(bringSyncLogEvent('verifying', 'Waiting', warning.key, since, now + 270_000), null);
});

test('Bring! bridge logs timed-out transactions only once, escalating to an error', () => {
    const warning = bringSyncLogEvent('verifying', 'Waiting', null, '2026-10-27T08:00:00.000Z',
        Date.parse('2026-10-27T08:04:00.000Z'));
    const error = bringSyncLogEvent('blocked', 'Sync timed out.', warning.key);
    assert.equal(error.level, 'error');
    assert.match(error.message, /BLOCKIERT/);
    assert.equal(bringSyncLogEvent('blocked', 'Sync timed out.', error.key), null);
    const healthy = bringSyncLogEvent('synced', 'No changes needed.', error.key);
    assert.equal(healthy.level, 'info');
    assert.equal(healthy.key, null);
    assert.equal(bringSyncLogEvent('synced', 'No changes needed.', null), null);
    assert.equal(bringSyncLogEvent('busy', 'Sorting', null), null);
});


test('pending writes are confirmed despite a new Bring! completion of an unchanged article', () => {
    const items = [b('Bifteki'), b('Salami'), b('Testartikel'), b('Äpfel')];
    const journal = baseline(items, items);
    journal.pending = {
        createdAt: '2026-10-27T09:31:19.798Z',
        bring: [b('Testartikel').key, b('Äpfel').key],
        alexa: [b('Testartikel').key, b('Äpfel').key],
    };
    const bringNow = [b('Äpfel')]; // User completed Testartikel while older deletes verified.
    const alexaNow = [a('test', '68> Testartikel'), a('apple', '37> Äpfel')];
    assert.equal(itemsMatchExpected(bringNow, journal.pending.bring), false);
    assert.equal(pendingWritesConfirmedExceptConcurrent(journal, bringNow, alexaNow), true);
    const verifiedBase = { ...journal, bring: journal.pending.bring, alexa: journal.pending.alexa };
    delete verifiedBase.pending;
    const next = reconcileBring('bidirectional', verifiedBase, bringNow, alexaNow);
    assert.deepEqual(next.removeFromAlexa.map(entry => entry.name), ['Testartikel']);
    assert.deepEqual(next.addToBring, []); // NEVER restore the completed article.
});

test('pending writes cannot be acknowledged if any originally requested removal failed', () => {
    const items = [b('Bifteki'), b('Salami'), b('Testartikel'), b('Äpfel')];
    const journal = baseline(items, items);
    journal.pending = {
        createdAt: '2026-10-27T09:31:19.798Z',
        bring: [b('Testartikel').key, b('Äpfel').key],
        alexa: [b('Testartikel').key, b('Äpfel').key],
    };
    assert.equal(pendingWritesConfirmedExceptConcurrent(
        journal, [b('Äpfel')], [a('b', 'Bifteki'), a('t', 'Testartikel'), a('ap', 'Äpfel')]), false);
});

test('pending writes cannot be acknowledged if a requested new item is still missing', () => {
    const old = [b('Äpfel')];
    const journal = baseline(old, old);
    journal.pending = {
        createdAt: '2026-10-27T09:31:19.798Z',
        bring: [b('Äpfel').key, b('Milch').key],
        alexa: [b('Äpfel').key, b('Milch').key],
    };
    assert.equal(pendingWritesConfirmedExceptConcurrent(journal, old, old), false);
    assert.equal(pendingWritesConfirmedExceptConcurrent(journal,
        [b('Äpfel'), b('Milch')], [a('ap', 'Äpfel'), a('milk', 'Milch'), a('new', 'Neu')]), true);
    assert.equal(pendingWritesConfirmedExceptConcurrent(baseline(old, old), old, old), false);
});
