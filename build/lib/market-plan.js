"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMarketHeader = formatMarketHeader;
exports.marketFromHeader = marketFromHeader;
exports.isMarketHeader = isMarketHeader;
exports.realActiveItems = realActiveItems;
exports.optimizeMarketAssignments = optimizeMarketAssignments;
exports.requiredMarkets = requiredMarkets;
exports.planMarketHeaderAction = planMarketHeaderAction;
exports.optimizeMarketHeaderCreationOrder = optimizeMarketHeaderCreationOrder;
const parser_1 = require("./parser");
const HEADER_PATTERN = /^----\s+(.+?)\s+----$/;
function formatMarketHeader(market) {
    return `---- ${String(market || '').trim().toLocaleUpperCase('de-DE')} ----`;
}
function marketFromHeader(value, markets) {
    const match = String(value || '').trim().match(HEADER_PATTERN);
    if (!match?.[1])
        return undefined;
    const wanted = (0, parser_1.normalize)(match[1]);
    return markets.find(market => market.enabled !== false && (0, parser_1.normalize)(market.name) === wanted)?.name;
}
function isMarketHeader(value, _markets) {
    return HEADER_PATTERN.test(String(value || '').trim());
}
function realActiveItems(list, markets) {
    return list.filter(item => item &&
        item.completed === false &&
        Boolean(item.id) &&
        Boolean(String(item.value || '').trim()) &&
        !isMarketHeader(String(item.value), markets));
}
function marketOrderMap(markets) {
    return new Map(markets.map(market => [market.name, Number.isFinite(Number(market.order)) ? Number(market.order) : 9999]));
}
function rankedMarkets(markets, counts, order) {
    return [...new Set(markets)].sort((a, b) => {
        const countDiff = (counts.get(b) || 0) - (counts.get(a) || 0);
        if (countDiff !== 0)
            return countDiff;
        const orderDiff = (order.get(a) || 9999) - (order.get(b) || 9999);
        if (orderDiff !== 0)
            return orderDiff;
        return a.localeCompare(b, 'de', { sensitivity: 'base' });
    });
}
function allowedMarketsForItem(item, markets, products) {
    if (item.parsed.explicitMarket)
        return [item.parsed.market];
    const product = (0, parser_1.findProduct)(item.parsed.productText, products);
    if (!product)
        return [item.parsed.market];
    const configured = (0, parser_1.parseMarketList)(product.availableMarkets, markets);
    if (!configured.length)
        return [item.parsed.market];
    return [...new Set([item.parsed.market, ...configured])];
}
function optimizeMarketAssignments(items, markets, products, fallbackMarket, priorityMarket = '', minimumItemsPerMarket = 1) {
    const parsedItems = items.map(source => ({
        source,
        parsed: (0, parser_1.parseItem)(String(source.value), markets, products, fallbackMarket, priorityMarket),
    }));
    const threshold = Math.max(1, Math.floor(Number(minimumItemsPerMarket) || 1));
    if (threshold <= 1 || parsedItems.length <= 1)
        return parsedItems;
    const order = marketOrderMap(markets);
    const counts = new Map();
    const allowed = new Map();
    const groups = new Map();
    const retained = new Set();
    for (const item of parsedItems) {
        const market = item.parsed.market;
        counts.set(market, (counts.get(market) || 0) + 1);
        const list = groups.get(market) || [];
        list.push(item);
        groups.set(market, list);
        const candidates = allowedMarketsForItem(item, markets, products);
        allowed.set(String(item.source.id), candidates);
        if (item.parsed.explicitMarket || candidates.length <= 1)
            retained.add(market);
    }
    for (const [market, count] of counts) {
        if (count >= threshold)
            retained.add(market);
    }
    if (!retained.size && counts.size) {
        const anchor = rankedMarkets(counts.keys(), counts, order)[0];
        if (anchor)
            retained.add(anchor);
    }
    const assignment = new Map();
    for (const item of parsedItems)
        assignment.set(String(item.source.id), item.parsed.market);
    const candidateGroups = [...groups.entries()]
        .filter(([market]) => !retained.has(market))
        .sort((a, b) => {
        const countDiff = a[1].length - b[1].length;
        if (countDiff !== 0)
            return countDiff;
        return (order.get(a[0]) || 9999) - (order.get(b[0]) || 9999);
    });
    for (const [market, group] of candidateGroups) {
        const targets = new Map();
        let canRemoveStop = true;
        for (const item of group) {
            const choices = (allowed.get(String(item.source.id)) || [market]).filter(candidate => retained.has(candidate));
            const target = rankedMarkets(choices, counts, order)[0];
            if (!target) {
                canRemoveStop = false;
                break;
            }
            targets.set(String(item.source.id), target);
        }
        if (!canRemoveStop) {
            retained.add(market);
            continue;
        }
        for (const item of group) {
            const id = String(item.source.id);
            const target = targets.get(id);
            if (!target || target === market)
                continue;
            assignment.set(id, target);
            counts.set(market, Math.max(0, (counts.get(market) || 0) - 1));
            counts.set(target, (counts.get(target) || 0) + 1);
        }
    }
    return parsedItems.map(item => {
        const market = assignment.get(String(item.source.id)) || item.parsed.market;
        return market === item.parsed.market
            ? item
            : { source: item.source, parsed: { ...item.parsed, market } };
    });
}
function requiredMarkets(items, markets, products, fallbackMarket, priorityMarket = '', minimumItemsPerMarket = 1) {
    const order = marketOrderMap(markets);
    const assigned = optimizeMarketAssignments(items, markets, products, fallbackMarket, priorityMarket, minimumItemsPerMarket);
    const used = new Set(assigned.map(item => item.parsed.market).filter(market => (0, parser_1.normalize)(market) !== (0, parser_1.normalize)(fallbackMarket)));
    return [...used].sort((a, b) => {
        const orderDiff = (order.get(a) || 9999) - (order.get(b) || 9999);
        if (orderDiff !== 0)
            return orderDiff;
        return a.localeCompare(b, 'de', { sensitivity: 'base' });
    });
}
function planMarketHeaderAction(list, required, markets, fallbackMarket, enabled) {
    const requiredSet = new Set(required.map(parser_1.normalize));
    const byMarket = new Map();
    const staleHeaders = [];
    for (const item of list) {
        const raw = String(item?.value || '').trim();
        const match = raw.match(HEADER_PATTERN);
        if (!match?.[1])
            continue;
        const market = marketFromHeader(raw, markets);
        if (!market || (0, parser_1.normalize)(market) === (0, parser_1.normalize)(fallbackMarket)) {
            staleHeaders.push({ market: match[1].trim(), item });
            continue;
        }
        const key = (0, parser_1.normalize)(market);
        const entry = byMarket.get(key) || { market, active: [], completed: [] };
        if (item.completed === false)
            entry.active.push(item);
        else
            entry.completed.push(item);
        byMarket.set(key, entry);
    }
    // Alte, umbenannte oder nicht mehr konfigurierte ShoppingRoute-Header vollständig entfernen.
    if (staleHeaders.length) {
        const stale = staleHeaders[0];
        return { type: 'delete', market: stale.market, id: String(stale.item.id) };
    }
    // Bei deaktivierter Funktion alle ShoppingRoute-Header aus der Alexa-Liste entfernen.
    if (!enabled) {
        for (const market of markets) {
            const entry = byMarket.get((0, parser_1.normalize)(market.name));
            const header = entry?.active[0] || entry?.completed[0];
            if (header)
                return { type: 'delete', market: entry?.market || market.name, id: String(header.id) };
        }
        return null;
    }
    // Für benötigte Märkte genau einen aktiven Header behalten.
    for (const market of required) {
        const key = (0, parser_1.normalize)(market);
        const entry = byMarket.get(key);
        if (entry?.active.length) {
            // Erledigte Alt-Header aus der bisherigen Beta zuerst aufräumen.
            if (entry.completed.length) {
                return { type: 'delete', market, id: String(entry.completed[0].id) };
            }
            if (entry.active.length > 1) {
                return { type: 'delete', market, id: String(entry.active[1].id) };
            }
            continue;
        }
        // Ein erledigter Alt-Header wird nicht reaktiviert, sondern gelöscht. Im nächsten Lauf wird sauber neu angelegt.
        if (entry?.completed.length) {
            return { type: 'delete', market, id: String(entry.completed[0].id) };
        }
        return { type: 'create', market, value: formatMarketHeader(market) };
    }
    // Nicht mehr benötigte Header vollständig löschen – auch bereits erledigte Alt-Header.
    for (const market of markets) {
        const key = (0, parser_1.normalize)(market.name);
        if ((0, parser_1.normalize)(market.name) === (0, parser_1.normalize)(fallbackMarket) || requiredSet.has(key))
            continue;
        const entry = byMarket.get(key);
        const header = entry?.active[0] || entry?.completed[0];
        if (header)
            return { type: 'delete', market: market.name, id: String(header.id) };
    }
    return null;
}
/**
 * Finds the lowest-scoring deterministic creation order. Header counts are normally small, so all permutations are
 * evaluated through six headers; larger inputs use deterministic insertion optimization to keep planning bounded.
 *
 * @param markets Missing market headers in their normal route order.
 * @param score Estimated final Amazon-write count for one creation order.
 * @returns Creation order with the lowest estimated write count.
 */
function optimizeMarketHeaderCreationOrder(markets, score) {
    const source = markets.map(String);
    if (source.length < 2)
        return source;
    let best = [...source];
    let bestScore = score(best);
    const consider = (candidate) => {
        const candidateScore = score(candidate);
        if (candidateScore < bestScore) {
            best = [...candidate];
            bestScore = candidateScore;
        }
    };
    if (source.length <= 6) {
        const visit = (prefix, remaining) => {
            if (remaining.length === 0) {
                consider(prefix);
                return;
            }
            for (let index = 0; index < remaining.length; index++) {
                visit(prefix.concat(remaining[index]), remaining.slice(0, index).concat(remaining.slice(index + 1)));
            }
        };
        visit([], source);
        return best;
    }
    let ordered = [];
    for (const market of source) {
        let insertion = ordered.concat(market);
        let insertionScore = score(insertion.concat(source.filter(entry => !insertion.includes(entry))));
        for (let index = 0; index <= ordered.length; index++) {
            const candidate = ordered.slice(0, index).concat(market, ordered.slice(index));
            const completed = candidate.concat(source.filter(entry => !candidate.includes(entry)));
            const candidateScore = score(completed);
            if (candidateScore < insertionScore) {
                insertion = candidate;
                insertionScore = candidateScore;
            }
        }
        ordered = insertion;
    }
    consider(ordered);
    return best;
}
//# sourceMappingURL=market-plan.js.map