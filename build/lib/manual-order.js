"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeManualOverrides = normalizeManualOverrides;
exports.overridesForList = overridesForList;
exports.clearManualOverridesForList = clearManualOverridesForList;
exports.reconcileManualOverrides = reconcileManualOverrides;
exports.moveManualOverride = moveManualOverride;
const PREFIX = /^(?:\d{2}>|\[\d{2}\])\s+(.+)$/s;
function scalar(value) {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
}
const norm = (value) => scalar(value).trim().toLocaleLowerCase('de');
const visibleText = (value) => {
    const text = scalar(value).trim();
    return text.match(PREFIX)?.[1]?.trim() || text;
};
function normalizeManualOverrides(value) {
    if (!Array.isArray(value))
        return [];
    const result = [];
    const seen = new Set();
    for (const entry of value) {
        if (!entry || typeof entry !== 'object')
            continue;
        const raw = entry;
        const listName = scalar(raw.listName).trim();
        const itemId = scalar(raw.itemId).trim();
        const originalText = scalar(raw.originalText).trim();
        const market = scalar(raw.market).trim();
        const position = Math.max(0, Math.min(98, Math.floor(Number(raw.position) || 0)));
        if (!listName || !itemId || !originalText || !market)
            continue;
        const key = norm(listName) + '\u0000' + itemId;
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push({
            listName,
            itemId,
            originalText,
            market,
            position,
            updatedAt: scalar(raw.updatedAt) || new Date(0).toISOString(),
        });
    }
    return result;
}
function overridesForList(overrides, listName) {
    const wanted = norm(listName);
    return normalizeManualOverrides(overrides).filter(entry => norm(entry.listName) === wanted);
}
function clearManualOverridesForList(overrides, listName) {
    const wanted = norm(listName);
    return normalizeManualOverrides(overrides).filter(entry => norm(entry.listName) !== wanted);
}
function reconcileManualOverrides(overrides, listName, items) {
    const wanted = norm(listName);
    const other = normalizeManualOverrides(overrides).filter(entry => norm(entry.listName) !== wanted);
    const current = items
        .filter(item => item && item.completed === false && item.id && visibleText(item.value))
        .map(item => ({ id: String(item.id), text: visibleText(item.value) }));
    const byId = new Map(current.map(item => [item.id, item]));
    const byText = new Map();
    for (const item of current) {
        const key = norm(item.text);
        const list = byText.get(key) || [];
        list.push(item);
        byText.set(key, list);
    }
    const resolved = [];
    const usedIds = new Set();
    for (const entry of overridesForList(overrides, listName)) {
        let match = byId.get(entry.itemId);
        if (!match) {
            const candidates = byText.get(norm(entry.originalText)) || [];
            if (candidates.length === 1)
                match = candidates[0];
        }
        if (!match || usedIds.has(match.id))
            continue;
        usedIds.add(match.id);
        resolved.push({ ...entry, itemId: match.id, originalText: match.text });
    }
    return other.concat(resolved);
}
function moveManualOverride(overrides, move) {
    const all = normalizeManualOverrides(overrides);
    const listKey = norm(move.listName);
    const fromKey = norm(move.fromMarket);
    const toKey = norm(move.toMarket);
    const fromPosition = Math.max(0, Math.floor(Number(move.fromPosition) || 0));
    const toPosition = Math.max(0, Math.floor(Number(move.toPosition) || 0));
    const shifted = all
        .filter(entry => !(norm(entry.listName) === listKey && entry.itemId === move.itemId))
        .map(entry => {
        if (norm(entry.listName) !== listKey)
            return entry;
        const marketKey = norm(entry.market);
        let position = entry.position;
        if (fromKey === toKey && marketKey === fromKey) {
            if (fromPosition < toPosition && position > fromPosition && position <= toPosition)
                position -= 1;
            else if (toPosition < fromPosition && position >= toPosition && position < fromPosition)
                position += 1;
        }
        else {
            if (marketKey === fromKey && position > fromPosition)
                position -= 1;
            if (marketKey === toKey && position >= toPosition)
                position += 1;
        }
        return position === entry.position ? entry : { ...entry, position };
    });
    shifted.push({
        listName: move.listName,
        itemId: move.itemId,
        originalText: move.originalText,
        market: move.toMarket,
        position: toPosition,
        updatedAt: new Date().toISOString(),
    });
    return normalizeManualOverrides(shifted);
}
//# sourceMappingURL=manual-order.js.map