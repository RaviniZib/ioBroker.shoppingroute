'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('runtime restricts Alexa create/delete writes to managed market headers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.ts'), 'utf8');

    // Normale Listeneinträge dürfen niemals automatisch erledigt werden.
    assert.doesNotMatch(source, /Lists\.[^\n]*\.completed/);

    // Genau ein #New- und ein #delete-Pfad sind erlaubt, beide ausschließlich im Header-Handler.
    assert.equal((source.match(/#New/g) || []).length, 1);
    assert.equal((source.match(/#delete/g) || []).length, 1);
    assert.match(source, /`\$\{this\.alexaInstance\}\.Lists\.\$\{listName\}\.#New`/);
    assert.match(
        source,
        /`\$\{this\.alexaInstance\}\.Lists\.\$\{listName\}\.items\.\$\{action\.id\}\.#delete`/,
    );
});
