"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.itemKey = itemKey;
exports.parseBringContent = parseBringContent;
exports.parseAlexaContent = parseAlexaContent;
exports.indexBridgeItems = indexBridgeItems;
exports.reconcileBring = reconcileBring;
exports.itemsMatchExpected = itemsMatchExpected;
exports.serializeBridgeBaseline = serializeBridgeBaseline;
exports.parseBridgeBaseline = parseBridgeBaseline;
const market_plan_1 = require("./market-plan");
const prefix_sort_1 = require("./prefix-sort");
function itemKey(name, specification = '') {
    const compact = (value) => String(value || '').normalize('NFC')
        .trim().replace(/\s+/g, ' ').toLocaleLowerCase('de-DE');
    return JSON.stringify([compact(name), compact(specification)]);
}
function item(name, specification, alexaId, alexaVersion) {
    if (typeof name !== 'string' || (specification != null && typeof specification !== 'string')) {
        throw new Error('Item must contain string name and specification.');
    }
    const n = name.trim();
    const spec = typeof specification === 'string' ? specification.trim() : '';
    if (!n || n.length > 250 || spec.length > 1000)
        throw new Error('Invalid or oversized shopping item.');
    return { key: itemKey(n, spec), name: n, specification: spec,
        text: spec ? n + ', ' + spec : n, alexaId, alexaVersion };
}
function parseBringContent(raw) {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(value))
        throw new Error('Bring! content is not a JSON array.');
    if (value.length > 250)
        throw new Error('Bring! list exceeds the 250-item safety limit.');
    return value.map(entry => {
        if (!entry || typeof entry !== 'object' || typeof entry.name !== 'string') {
            throw new Error('Bring! item has no valid name.');
        }
        return item(entry.name, entry.specification);
    });
}
function parseAlexaContent(list, markets) {
    return list.filter(entry => entry && entry.completed === false && entry.id).flatMap(entry => {
        const value = (0, prefix_sort_1.stripSortPrefix)(String(entry.value || ''));
        if (!value || (0, market_plan_1.isMarketHeader)(value, markets) || /^\d{2}[WCFHEURD][\p{L}\d]+$/iu.test(value))
            return [];
        const comma = value.indexOf(',');
        const name = comma < 0 ? value : value.slice(0, comma);
        const specification = comma < 0 ? '' : value.slice(comma + 1);
        return [item(name, specification, String(entry.id), Number(entry.version))];
    });
}
function indexBridgeItems(items, side) {
    const map = new Map();
    const names = new Map();
    for (const entry of items) {
        const nameKey = itemKey(entry.name);
        if (map.has(entry.key) || names.has(nameKey)) {
            throw new Error(side + ': duplicate or ambiguous item "' + entry.name + '". Resolve manually.');
        }
        map.set(entry.key, entry);
        names.set(nameKey, entry.key);
    }
    return map;
}
function reconcileBring(mode, previous, bringItems, alexaItems) {
    if (mode !== 'import' && mode !== 'bidirectional')
        throw new Error('Invalid synchronization mode.');
    if (previous?.pending)
        throw new Error('Pending synchronization must be verified first.');
    const b = indexBridgeItems(bringItems, 'Bring!');
    const a = indexBridgeItems(alexaItems, 'Alexa');
    // Bring! treats the product name as its identity. Different specifications for
    // the same product are ambiguous and must never be silently overwritten.
    for (const bring of b.values()) {
        const other = alexaItems.find(entry => itemKey(entry.name) === itemKey(bring.name));
        if (other && other.key !== bring.key) {
            throw new Error('Conflicting specifications for "' + bring.name + '". Resolve manually.');
        }
    }
    const oldB = new Set(previous?.bring || []);
    const oldA = new Set(previous?.alexa || []);
    const desiredB = new Set(b.keys());
    const desiredA = new Set(a.keys());
    const universe = new Set([...oldB, ...oldA, ...b.keys(), ...a.keys()]);
    for (const key of universe) {
        const nowB = b.has(key);
        const nowA = a.has(key);
        if (!previous) {
            if (mode === 'bidirectional' && nowA)
                desiredB.add(key);
            if (nowB)
                desiredA.add(key);
            continue;
        }
        const bChanged = oldB.has(key) !== nowB;
        const aChanged = oldA.has(key) !== nowA;
        if (mode === 'import') {
            // Alexa-only changes are outside the scope of one-way mirroring.
            if (bChanged && nowB)
                desiredA.add(key);
            if (bChanged && !nowB && oldA.has(key))
                desiredA.delete(key);
            if (!bChanged && nowB && !nowA && oldA.has(key)) {
                // Alexa removed its copy: do not recreate against an explicit user action.
                desiredA.delete(key);
            }
        }
        else if (bChanged && aChanged && nowB !== nowA) {
            throw new Error('Conflicting simultaneous changes; no automatic deletion.');
        }
        else if (bChanged && !aChanged) {
            if (nowB)
                desiredA.add(key);
            else
                desiredA.delete(key);
        }
        else if (aChanged && !bChanged) {
            if (nowA)
                desiredB.add(key);
            else
                desiredB.delete(key);
        }
        else if (bChanged && aChanged) {
            if (nowB) {
                desiredB.add(key);
                desiredA.add(key);
            }
            else {
                desiredB.delete(key);
                desiredA.delete(key);
            }
        }
        else if (nowB !== nowA) {
            throw new Error('Lists are inconsistent without a tracked change. Resync manually.');
        }
    }
    const all = new Map([...a, ...b]);
    const asItems = (keys) => [...keys].map(key => {
        const value = all.get(key);
        if (!value)
            throw new Error('Missing original item for synchronization.');
        return value;
    });
    const delta = (target, current) => asItems([...target].filter(key => !current.has(key)));
    const gone = (target, current) => [...current].filter(([key]) => !target.has(key)).map(([, value]) => value);
    return {
        addToBring: delta(desiredB, b), removeFromBring: gone(desiredB, b),
        addToAlexa: delta(desiredA, a), removeFromAlexa: gone(desiredA, a),
        expectedBring: [...desiredB].sort(), expectedAlexa: [...desiredA].sort(),
        initial: !previous,
    };
}
function itemsMatchExpected(items, expected) {
    return JSON.stringify([...indexBridgeItems(items, 'Verification').keys()].sort()) === JSON.stringify([...expected].sort());
}
function serializeBridgeBaseline(baseline) {
    return JSON.stringify(baseline);
}
function parseBridgeBaseline(raw) {
    if (raw == null || raw === '' || raw === '{}')
        return null;
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || value.version !== 1 ||
        typeof value.scope !== 'string' || !Array.isArray(value.bring) || !Array.isArray(value.alexa) ||
        !value.bring.every((s) => typeof s === 'string') ||
        !value.alexa.every((s) => typeof s === 'string'))
        throw new Error('Invalid Bring! sync journal; manual recovery needed.');
    if (value.pending && (typeof value.pending.createdAt !== 'string' ||
        !Array.isArray(value.pending.bring) || !Array.isArray(value.pending.alexa) ||
        !value.pending.bring.every((s) => typeof s === 'string') ||
        !value.pending.alexa.every((s) => typeof s === 'string'))) {
        throw new Error('Invalid pending Bring! sync journal; manual recovery needed.');
    }
    return value;
}
//# sourceMappingURL=bring-sync.js.map