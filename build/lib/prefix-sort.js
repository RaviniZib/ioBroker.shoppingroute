"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSortPrefix = parseSortPrefix;
exports.stripSortPrefix = stripSortPrefix;
exports.formatSortPrefix = formatSortPrefix;
exports.buildPrefixTargets = buildPrefixTargets;
exports.createPrefixSortPlan = createPrefixSortPlan;
exports.expectedValues = expectedValues;
exports.verifyPrefixResult = verifyPrefixResult;
const market_plan_1 = require("./market-plan");
const parser_1 = require("./parser");
const SORT_PREFIX = /^(\d{2})>\s+(.+)$/s;
const LEGACY_SORT_PREFIX = /^\[(\d{2})\]\s+(.+)$/s;
function parseSortPrefix(text) {
    const value = String(text || '').trim();
    const match = value.match(SORT_PREFIX) || value.match(LEGACY_SORT_PREFIX);
    if (!match)
        return undefined;
    const number = Number(match[1]);
    const originalText = String(match[2] || '').trim();
    if (!Number.isInteger(number) || number < 0 || number > 99 || !originalText)
        return undefined;
    return { number, originalText };
}
function stripSortPrefix(text) {
    return parseSortPrefix(text)?.originalText ?? String(text || '').trim();
}
function formatSortPrefix(number, originalText) {
    if (!Number.isInteger(number) || number < 0 || number > 99) {
        throw new Error(`Ungültiger ShoppingRoute-Sortierpräfix: ${number}`);
    }
    const text = stripSortPrefix(originalText);
    if (!text)
        throw new Error('Ein Sortierpräfix benötigt einen sichtbaren Originaltext.');
    return `${String(number).padStart(2, '0')}> ${text}`;
}
function marketOrder(markets, marketName) {
    const market = markets.find(entry => (0, parser_1.normalize)(entry.name) === (0, parser_1.normalize)(marketName));
    return Number.isFinite(Number(market?.order)) ? Number(market?.order) : 9999;
}
function categoryOrder(routes, marketName, category) {
    const marketRoutes = routes.filter(entry => (0, parser_1.normalize)(entry.market) === (0, parser_1.normalize)(marketName));
    const index = marketRoutes.findIndex(entry => (0, parser_1.normalize)(entry.category) === (0, parser_1.normalize)(category));
    if (index >= 0)
        return (index + 1) * 10;
    const route = routes.find(entry => (0, parser_1.normalize)(entry.market) === (0, parser_1.normalize)(marketName) && (0, parser_1.normalize)(entry.category) === (0, parser_1.normalize)(category));
    return Number.isFinite(Number(route?.order)) ? Number(route?.order) : 9999;
}
function active(items) {
    return items.filter(item => item && item.completed === false && item.id && stripSortPrefix(item.value));
}
function usableVersion(item) {
    const version = Number(item.version);
    return Number.isInteger(version) && version > 0 ? version : undefined;
}
/**
 * Build the one logical route order. Product and market recognition always sees prefix-free text.
 *
 * @param items Current direct Amazon list snapshot.
 * @param markets Configured active markets.
 * @param routes Configured walking routes.
 * @param products Configured product catalogue.
 * @param fallbackMarket Market used when no assignment matches.
 * @param priorityMarket Current market priority.
 * @param minimumItemsPerMarket Consolidation threshold.
 * @param marketHeaders Whether market headers belong in the route.
 */
function buildPrefixTargets(items, markets, routes, products, fallbackMarket, priorityMarket = '', minimumItemsPerMarket = 1, marketHeaders = false) {
    const current = active(items);
    const headersByMarket = new Map();
    const real = [];
    for (const item of current) {
        const text = stripSortPrefix(item.value);
        const headerMarket = (0, market_plan_1.marketNameFromHeader)(text, markets);
        if (headerMarket) {
            const market = markets.find(entry => entry.enabled !== false && (0, parser_1.normalize)(entry.name) === (0, parser_1.normalize)(headerMarket));
            if (market) {
                const entries = headersByMarket.get((0, parser_1.normalize)(market.name)) || [];
                entries.push(item);
                headersByMarket.set((0, parser_1.normalize)(market.name), entries);
            }
            continue;
        }
        real.push({ ...item, value: text });
    }
    const assigned = (0, market_plan_1.optimizeMarketAssignments)(real, markets, products, fallbackMarket, priorityMarket, minimumItemsPerMarket).map(entry => ({
        ...entry,
        marketOrder: marketOrder(markets, entry.parsed.market),
        categoryOrder: categoryOrder(routes, entry.parsed.market, entry.parsed.category),
    })).sort((left, right) => {
        if (left.marketOrder !== right.marketOrder)
            return left.marketOrder - right.marketOrder;
        if (left.categoryOrder !== right.categoryOrder)
            return left.categoryOrder - right.categoryOrder;
        const category = left.parsed.category.localeCompare(right.parsed.category, 'de', { sensitivity: 'base' });
        if (category !== 0 && left.categoryOrder === 9999 && right.categoryOrder === 9999)
            return category;
        const product = left.parsed.productName.localeCompare(right.parsed.productName, 'de', { sensitivity: 'base' });
        if (product !== 0)
            return product;
        return String(left.source.id).localeCompare(String(right.source.id));
    });
    const targets = [];
    let lastMarket = '';
    for (const entry of assigned) {
        const market = entry.parsed.market;
        if (marketHeaders &&
            (0, parser_1.normalize)(market) !== (0, parser_1.normalize)(fallbackMarket) &&
            (0, parser_1.normalize)(market) !== (0, parser_1.normalize)(lastMarket)) {
            const existing = headersByMarket.get((0, parser_1.normalize)(market))?.shift();
            const text = (0, market_plan_1.formatMarketHeader)(market);
            targets.push({
                key: existing ? `id:${existing.id}` : `header:${(0, parser_1.normalize)(market)}`,
                id: existing?.id,
                version: existing ? usableVersion(existing) : undefined,
                originalText: text,
                market,
                category: '',
                product: text,
                currentValue: existing ? String(existing.value).trim() : undefined,
                currentPrefix: existing ? parseSortPrefix(existing.value)?.number : undefined,
            });
        }
        const originalText = stripSortPrefix(entry.parsed.originalText);
        targets.push({
            key: `id:${entry.source.id}`,
            id: String(entry.source.id),
            version: usableVersion(entry.source),
            originalText,
            market,
            category: entry.parsed.category,
            product: entry.parsed.productName,
            currentValue: String(items.find(item => String(item.id) === String(entry.source.id))?.value || '').trim(),
            currentPrefix: parseSortPrefix(items.find(item => String(item.id) === String(entry.source.id))?.value || '')?.number,
        });
        lastMarket = market;
    }
    if (targets.length > 99)
        throw new Error(`Die Liste enthält ${targets.length} Soll-Einträge; maximal 99 sind zulässig.`);
    return targets;
}
function distribute(lowerExclusive, upperExclusive, count) {
    const available = upperExclusive - lowerExclusive - 1;
    if (count < 1)
        return [];
    if (available < count)
        return undefined;
    const numbers = [];
    for (let index = 1; index <= count; index++) {
        const number = Math.floor(lowerExclusive + (index * (upperExclusive - lowerExclusive)) / (count + 1));
        if (number <= lowerExclusive || number >= upperExclusive || numbers.includes(number))
            return undefined;
        numbers.push(number);
    }
    return numbers;
}
function staleActiveItems(items, desiredIds) {
    return active(items).filter(item => !desiredIds.has(String(item.id)));
}
function requireWritableItem(item, action) {
    if (!item.id || !item.version)
        throw new Error(`${action}: Item-ID oder positive Amazon-Version fehlt.`);
}
function buildFallback(items, desired, problemIndex) {
    let rebuildFrom = Math.max(0, problemIndex);
    // A missing target or a target whose visible position is not already exact ends the reusable prefix.
    for (let index = 0; index < rebuildFrom; index++) {
        const target = desired[index];
        if (!target.id || target.currentPrefix === undefined || target.currentValue !== formatSortPrefix(target.currentPrefix, target.originalText)) {
            rebuildFrom = index;
            break;
        }
        if (index > 0 && target.currentPrefix <= (desired[index - 1].currentPrefix || 0)) {
            rebuildFrom = index;
            break;
        }
    }
    let lower = rebuildFrom > 0 ? desired[rebuildFrom - 1].currentPrefix ?? -1 : -1;
    let numbers = distribute(lower, 100, desired.length - rebuildFrom);
    // A high preserved prefix (for example 99) may leave too little suffix space. Move the rebuild point upward only
    // as far as necessary so the remaining targets can be spread over 00>–99> without renumbering a larger prefix.
    while (!numbers && rebuildFrom > 0) {
        rebuildFrom -= 1;
        lower = rebuildFrom > 0 ? desired[rebuildFrom - 1].currentPrefix ?? -1 : -1;
        numbers = distribute(lower, 100, desired.length - rebuildFrom);
    }
    if (!numbers)
        throw new Error('Der neu aufzubauende Listenteil passt nicht in die Präfixe 00>–99>.');
    const deleteById = new Map();
    for (const item of staleActiveItems(items, new Set(desired.slice(0, rebuildFrom).flatMap(target => target.id ? [target.id] : [])))) {
        const version = usableVersion(item);
        if (!version)
            throw new Error(`DELETE für ID ${item.id}: positive Amazon-Version fehlt.`);
        deleteById.set(String(item.id), { id: String(item.id), version, value: String(item.value).trim() });
    }
    const creates = desired.slice(rebuildFrom).map((target, index) => ({
        key: target.key,
        originalText: target.originalText,
        value: formatSortPrefix(numbers[index], target.originalText),
    }));
    return {
        desired,
        updates: [],
        deletes: [...deleteById.values()],
        creates,
        fallback: true,
        rebuildFrom,
    };
}
/**
 * Preserve every already valid ordered prefix. Number all gaps evenly. The first gap that cannot hold its targets
 * switches to a deterministic suffix rebuild; no prefix above that point is touched.
 *
 * @param items Current direct Amazon list snapshot.
 * @param desired Fully ordered prefix-free route targets.
 */
function createPrefixSortPlan(items, desired) {
    if (desired.length > 99)
        throw new Error('Maximal 99 aktive Listeneinträge sind zulässig.');
    const fixed = [];
    for (let index = 0; index < desired.length; index++) {
        const target = desired[index];
        if (target.id && target.currentPrefix !== undefined)
            fixed.push({ index, number: target.currentPrefix });
    }
    let previousIndex = -1;
    let previousNumber = -1;
    const assigned = new Map();
    const boundaries = [...fixed, { index: desired.length, number: 100 }];
    for (const boundary of boundaries) {
        if (boundary.number <= previousNumber || boundary.index <= previousIndex) {
            return buildFallback(items, desired, Math.max(0, boundary.index));
        }
        const gapCount = boundary.index - previousIndex - 1;
        const numbers = distribute(previousNumber, boundary.number, gapCount);
        if (!numbers)
            return buildFallback(items, desired, previousIndex + 1);
        numbers.forEach((number, offset) => assigned.set(previousIndex + 1 + offset, number));
        if (boundary.index < desired.length)
            assigned.set(boundary.index, boundary.number);
        previousIndex = boundary.index;
        previousNumber = boundary.number;
    }
    const updates = [];
    const creates = [];
    for (let index = 0; index < desired.length; index++) {
        const target = desired[index];
        const to = formatSortPrefix(assigned.get(index), target.originalText);
        if (!target.id) {
            creates.push({ key: target.key, value: to, originalText: target.originalText });
            continue;
        }
        if (target.currentValue === to)
            continue;
        requireWritableItem(target, `UPDATE für ID ${target.id}`);
        updates.push({ id: target.id, version: target.version, from: target.currentValue || '', to });
    }
    const desiredIds = new Set(desired.flatMap(target => target.id ? [target.id] : []));
    const deletes = staleActiveItems(items, desiredIds).map(item => {
        const version = usableVersion(item);
        if (!version)
            throw new Error(`DELETE für ID ${item.id}: positive Amazon-Version fehlt.`);
        return { id: String(item.id), version, value: String(item.value).trim() };
    });
    return { desired, updates, deletes, creates, fallback: false, rebuildFrom: null };
}
function expectedValues(plan) {
    if (plan.fallback) {
        const kept = plan.desired.slice(0, plan.rebuildFrom || 0).map(target => String(target.currentValue));
        return kept.concat(plan.creates.map(create => create.value));
    }
    const updated = new Map(plan.updates.map(update => [update.id, update.to]));
    const created = new Map(plan.creates.map(create => [create.key, create.value]));
    return plan.desired.map(target => target.id ? (updated.get(target.id) || String(target.currentValue)) : created.get(target.key)).filter(Boolean);
}
function verifyPrefixResult(items, plan, allowAdditionalExternalItems = false) {
    const current = active(items);
    const byId = new Map(current.map(item => [String(item.id), String(item.value).trim()]));
    for (const deletion of plan.deletes) {
        if (byId.has(deletion.id))
            return { ok: false, reason: `Gelöschte ID ${deletion.id} ist weiterhin aktiv.` };
    }
    const updated = new Map(plan.updates.map(update => [update.id, update.to]));
    const keptTargets = plan.fallback ? plan.desired.slice(0, plan.rebuildFrom || 0) : plan.desired;
    for (const target of keptTargets) {
        if (!target.id)
            continue;
        const wanted = updated.get(target.id) || target.currentValue;
        if (!wanted || byId.get(target.id) !== wanted) {
            return { ok: false, reason: `ID ${target.id} besitzt nicht den erwarteten Zielwert „${wanted || ''}“.` };
        }
    }
    if (allowAdditionalExternalItems) {
        const actualCounts = new Map();
        for (const item of current) {
            const value = String(item.value).trim();
            actualCounts.set(value, (actualCounts.get(value) || 0) + 1);
        }
        const createdCounts = new Map();
        for (const create of plan.creates)
            createdCounts.set(create.value, (createdCounts.get(create.value) || 0) + 1);
        for (const [value, count] of createdCounts) {
            if ((actualCounts.get(value) || 0) < count) {
                return { ok: false, reason: `Batch-CREATE-Ziel „${value}“ ist nicht vollständig vorhanden.` };
            }
        }
        return { ok: true };
    }
    const actual = current.map(item => String(item.value).trim()).sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
    const expected = expectedValues(plan);
    if (actual.length !== expected.length)
        return { ok: false, reason: `Erwartet ${expected.length}, gefunden ${actual.length} aktive Items.` };
    for (let index = 0; index < expected.length; index++) {
        if (actual[index] !== expected[index]) {
            return { ok: false, reason: `Position ${index + 1}: erwartet „${expected[index]}“, gefunden „${actual[index]}“.` };
        }
    }
    const expectedOriginals = expected.map(stripSortPrefix).sort();
    const actualOriginals = actual.map(stripSortPrefix).sort();
    if (JSON.stringify(expectedOriginals) !== JSON.stringify(actualOriginals)) {
        return { ok: false, reason: 'Die sichtbaren Originaltexte stimmen nach dem Apply nicht überein.' };
    }
    return { ok: true };
}
//# sourceMappingURL=prefix-sort.js.map