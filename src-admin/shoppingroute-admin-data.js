'use strict';

/* eslint-disable jsdoc/require-jsdoc */

function trimString(value) {
    return String(value == null ? '' : value).trim();
}

function sortLabels(left, right) {
    return String(left).localeCompare(String(right), 'de', { sensitivity: 'base' });
}

function marketOptions(markets, { includeEmpty = false, onlyEnabled = false } = {}) {
    const options = (Array.isArray(markets) ? markets : [])
        .filter(market => market && typeof market === 'object')
        .filter(market => !onlyEnabled || market.enabled !== false)
        .map(market => trimString(market.name))
        .filter(Boolean)
        .sort(sortLabels)
        .map(name => ({ value: name, label: name }));

    if (includeEmpty) {
        options.unshift({ value: '', label: '—' });
    }

    return options;
}

function productGroupOptions(productGroups) {
    return (Array.isArray(productGroups) ? productGroups : [])
        .filter(group => group && typeof group === 'object')
        .map(group => trimString(group.name))
        .filter(Boolean)
        .sort(sortLabels)
        .map(name => ({ value: name, label: name }));
}

function splitCommaList(value) {
    return String(value || '')
        .split(/[;,]/)
        .map(part => part.trim())
        .filter(Boolean);
}

function uniqueStrings(values) {
    const result = [];
    const seen = new Set();
    for (const value of values) {
        const trimmed = trimString(value);
        const key = trimmed.toLocaleLowerCase('de');
        if (!trimmed || seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(trimmed);
    }
    return result;
}

function joinCommaList(values) {
    return uniqueStrings(Array.isArray(values) ? values : splitCommaList(values)).join(',');
}

module.exports = {
    joinCommaList,
    marketOptions,
    productGroupOptions,
    splitCommaList,
    trimString,
    uniqueStrings,
};
