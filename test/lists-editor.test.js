'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  Components: { ListsEditor },
  ListsEditorModel: model,
} = require('../src-admin/lists-editor');

const existing = [
  { enabled: true, name: 'Einkauf', priorityMarket: 'ALDI' },
  { enabled: false, name: 'Baumarkt', priorityMarket: 'BAUMARKT' },
];

test('lists editor loads existing rows without changing order or structure', () => {
  assert.deepEqual(model.listRows(existing), existing);
});

test('lists editor adds, edits, removes and reorders list drafts immutably', () => {
  const added = model.addList(existing);
  assert.deepEqual(added.at(-1), { enabled: true, name: '', priorityMarket: '' });

  const edited = model.editList(added, 2, { name: 'Drogerie', priorityMarket: 'DM', enabled: false });
  assert.deepEqual(edited.at(-1), { enabled: false, name: 'Drogerie', priorityMarket: 'DM' });

  const moved = model.moveList(edited, 2, -1);
  assert.deepEqual(moved.map(entry => entry.name), ['Einkauf', 'Drogerie', 'Baumarkt']);

  const removed = model.removeList(moved, 1);
  assert.deepEqual(removed, existing);
  assert.deepEqual(existing, [
    { enabled: true, name: 'Einkauf', priorityMarket: 'ALDI' },
    { enabled: false, name: 'Baumarkt', priorityMarket: 'BAUMARKT' },
  ]);
});

test('lists editor writes only through the normal admin draft object', () => {
  const persisted = {
    alexaInstance: 'alexa2.0',
    lists: structuredClone(existing),
    markets: [{ enabled: true, order: 10, name: 'ALDI', aliases: '' }],
    dryRun: true,
  };
  const calls = [];
  const editor = new ListsEditor({
    data: persisted,
    onChange: (draft, changed) => calls.push({ draft, changed }),
  });

  editor.updateLists(model.editList(persisted.lists, 0, { priorityMarket: 'LIDL' }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].changed, true);
  assert.deepEqual(calls[0].draft, {
    alexaInstance: 'alexa2.0',
    lists: [
      { enabled: true, name: 'Einkauf', priorityMarket: 'LIDL' },
      { enabled: false, name: 'Baumarkt', priorityMarket: 'BAUMARKT' },
    ],
    markets: [{ enabled: true, order: 10, name: 'ALDI', aliases: '' }],
    dryRun: true,
  });
  assert.deepEqual(persisted.lists, existing);

  const source = readFileSync(join(__dirname, '..', 'src-admin', 'lists-editor.js'), 'utf8');
  assert.doesNotMatch(source, /setObject|extendObject|setStateAsync/);
});
