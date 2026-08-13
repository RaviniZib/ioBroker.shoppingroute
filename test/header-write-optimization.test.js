'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { activeItems, createSortPlan } = require('../build/lib/sorter');
const {
    createBufferedSortMarker,
    createBufferedSortProgram,
    createVisibleOrderRefreshPlan,
    sortIdsByAlexaUpdatedTime,
} = require('../build/lib/buffered-sort');
const {
    formatMarketHeader,
    optimizeMarketHeaderCreationOrder,
} = require('../build/lib/market-plan');

const marketNames = ['ALDI', 'LIDL', 'REWE', 'EDEKA', 'KAUFLAND'];
const markets = marketNames
    .map((name, index) => ({ name, aliases: '', order: (index + 1) * 10, enabled: true }))
    .concat({ name: 'Ohne Markt', aliases: '', order: 999, enabled: true });
const routes = marketNames.map(market => ({ market, category: 'Gruppe', order: 10 }));
const products = marketNames.flatMap((market, marketIndex) => Array.from({ length: 4 }, (_entry, itemIndex) => ({
    name: `Produkt ${marketIndex * 4 + itemIndex + 1}`,
    aliases: '',
    category: 'Gruppe',
    defaultMarket: market,
    availableMarkets: market,
})));

function baseList(values) {
    return values.map((value, index) => ({
        id: `article-${index}`,
        value,
        completed: false,
        createdDateTime: index + 1,
        updatedDateTime: index + 1,
    }));
}

function estimate(base, headerOrder) {
    const list = base.map(entry => ({ ...entry }));
    headerOrder.forEach((market, index) => list.push({
        id: `header-${index}`,
        value: formatMarketHeader(market),
        completed: false,
        createdDateTime: 100 + index,
        updatedDateTime: 100 + index,
    }));
    const plan = createSortPlan(list, markets, routes, products, 'Ohne Markt', '', 1, true);
    const currentOrderIds = sortIdsByAlexaUpdatedTime(activeItems(list));
    const desiredOrderIds = [...plan].sort((left, right) => left.position - right.position).map(entry => entry.id);
    const marker = createBufferedSortMarker('HeaderPlanTest', 0, plan.flatMap(entry => [entry.from, entry.to]));
    const program = createBufferedSortProgram(plan, marker, { currentOrderIds, desiredOrderIds });
    const afterContent = [...currentOrderIds];
    for (const step of program.steps) {
        afterContent.splice(afterContent.indexOf(step.id), 1);
        afterContent.push(step.id);
    }
    const touches = createVisibleOrderRefreshPlan(afterContent, desiredOrderIds);
    return {
        totalWrites: headerOrder.length + program.amazonWrites + touches.length * 2,
        contentWrites: program.amazonWrites,
        visibleTouches: touches.length,
    };
}

test('empty-header five-market twenty-article case reduces total writes and visible touches', () => {
    const base = baseList(products.map(product => product.name).reverse());
    const before = estimate(base, marketNames);
    const optimizedOrder = optimizeMarketHeaderCreationOrder(
        marketNames,
        order => estimate(base, order).totalWrites,
    );
    const after = estimate(base, optimizedOrder);

    assert.deepEqual(before, { totalWrites: 78, contentWrites: 29, visibleTouches: 22 });
    assert.deepEqual(optimizedOrder, ['KAUFLAND', 'REWE', 'EDEKA', 'LIDL', 'ALDI']);
    assert.deepEqual(after, { totalWrites: 73, contentWrites: 28, visibleTouches: 20 });
});

test('header-order optimization never worsens a partially sorted list', () => {
    const values = products.map(product => product.name);
    const partiallySorted = values.slice(0, 12).concat(values.slice(12).reverse());
    const base = baseList(partiallySorted);
    const before = estimate(base, marketNames);
    const optimizedOrder = optimizeMarketHeaderCreationOrder(
        marketNames,
        order => estimate(base, order).totalWrites,
    );
    const after = estimate(base, optimizedOrder);

    assert.ok(after.totalWrites <= before.totalWrites);
    assert.ok(after.visibleTouches <= before.visibleTouches || after.totalWrites < before.totalWrites);
});
