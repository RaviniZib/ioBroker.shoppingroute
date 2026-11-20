'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { COMMANDS, HELP } = require('../build/lib/help');

const source = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
const start = source.indexOf('private async onMessage(');
const end = source.indexOf('private async onStateChange(');
const handler = source.slice(start, end);

test('COMMANDS lists exactly the commands onMessage answers, each once', () => {
    assert.ok(start > 0 && end > start, 'onMessage found');
    const answered = [...new Set([...handler.matchAll(/obj\.command === '([^']+)'/g)].map(m => m[1]))];
    const listed = COMMANDS.map(entry => entry.command);
    assert.equal(new Set(listed).size, listed.length, 'no duplicates');
    assert.deepEqual([...listed].sort(), answered.sort());
});

test('the commands blocked in the read-only Bring! mode are write commands', () => {
    const blocked = handler.slice(0, handler.indexOf('.includes(obj.command)'));
    const names = [...blocked.slice(blocked.lastIndexOf('[')).matchAll(/'([^']+)'/g)].map(m => m[1]);
    assert.ok(names.length > 3);
    for (const name of names) {
        assert.equal(COMMANDS.find(entry => entry.command === name)?.write, true, name);
    }
});

test('HELP names every command and keeps the lines short', () => {
    for (const { command } of COMMANDS.filter(entry => entry.command !== 'help')) {
        assert.ok(HELP.includes(command), command);
    }
    assert.ok(HELP.includes('Commands (sendTo shoppingroute.0'));
    assert.ok(HELP.includes('How to talk to the user:'));
    for (const line of HELP.split('\n')) {
        assert.ok(line.length <= 120, line);
    }
});
