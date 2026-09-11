'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');
const h = React.createElement;

const text = (de, en) => {
    const language = typeof navigator !== 'undefined' ? String(navigator.language || '').toLowerCase() : 'de';
    return language.startsWith('de') ? de : en;
};

const keyOf = value =>
    String(value || '')
        .trim()
        .toLocaleLowerCase('de');

const looseKey = value =>
    String(value || '')
        .trim()
        .toLocaleLowerCase('de')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

function canonicalProductKey(value) {
    let key = looseKey(value).replace(/\s+/g, '');
    if (key.length > 6 && key.endsWith('en')) key = key.slice(0, -1);
    else if (key.length > 6 && key.endsWith('n')) key = key.slice(0, -1);
    return key;
}

function normalizeMarketCsv(value) {
    const source = Array.isArray(value) ? value : String(value || '').split(/[;,]/);
    const seen = new Set();
    return source
        .map(entry => String(entry || '').trim())
        .filter(entry => {
            const key = keyOf(entry);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .join(',');
}

function activeMarkets(data) {
    const result = [];
    const seen = new Set();
    for (const market of Array.isArray(data?.markets) ? data.markets : []) {
        if (!market || market.enabled === false) continue;
        const name = String(market.name || '').trim();
        const key = keyOf(name);
        if (!name || seen.has(key)) continue;
        seen.add(key);
        result.push(name);
    }
    return result.sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
}

function productGroups(data) {
    const seen = new Set();
    return (Array.isArray(data?.productGroups) ? data.productGroups : [])
        .map(group => String(group?.name || '').trim())
        .filter(name => {
            const key = keyOf(name);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
}

function productKeys(product) {
    return [product?.name, ...String(product?.aliases || '').split(/[;,]/)]
        .map(canonicalProductKey)
        .filter(Boolean);
}

function findProductIndex(products, name) {
    const wanted = canonicalProductKey(name);
    if (!wanted) return -1;
    return products.findIndex(product => productKeys(product).includes(wanted));
}

function mergeAliases(existing, incoming) {
    const result = [];
    const seen = new Set();
    for (const value of `${existing || ''},${incoming || ''}`.split(/[;,]/)) {
        const alias = String(value || '').trim();
        const key = keyOf(alias);
        if (!alias || seen.has(key)) continue;
        seen.add(key);
        result.push(alias);
    }
    return result.join(',');
}

function updateReviewRow(data, index, patch) {
    const reviewItems = (Array.isArray(data?.reviewItems) ? data.reviewItems : []).map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : { ...row },
    );
    return { ...(data || {}), reviewItems };
}

function acceptReviewRows(data, indexes) {
    const wanted = new Set(indexes);
    const products = (Array.isArray(data?.products) ? data.products : []).map(product => ({ ...product }));
    const reviewItems = (Array.isArray(data?.reviewItems) ? data.reviewItems : []).map(row => ({ ...row }));

    for (let index = 0; index < reviewItems.length; index++) {
        if (!wanted.has(index)) continue;
        const review = reviewItems[index];
        const name = String(review.product || '').trim();
        if (!name) continue;

        const found = findProductIndex(products, name);
        if (found >= 0) {
            const existing = { ...products[found] };
            if (review.category) existing.category = String(review.category);
            if (review.defaultMarket !== undefined) existing.defaultMarket = String(review.defaultMarket || '');
            if (review.availableMarkets !== undefined) existing.availableMarkets = normalizeMarketCsv(review.availableMarkets);
            if (review.aliases) existing.aliases = mergeAliases(existing.aliases, review.aliases);
            products[found] = existing;
        } else {
            products.push({
                name,
                aliases: String(review.aliases || ''),
                category: String(review.category || review.guessedCategory || 'Sonstiges'),
                defaultMarket: String(review.defaultMarket || ''),
                availableMarkets: normalizeMarketCsv(review.availableMarkets),
            });
        }
        reviewItems[index] = {
            ...review,
            availableMarkets: normalizeMarketCsv(review.availableMarkets),
            action: 'accepted',
        };
    }

    products.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'de', { sensitivity: 'base' }));
    return { ...(data || {}), products, reviewItems };
}

const styles = `
.shoppingroute-review-toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 14px}
.shoppingroute-review-button{min-height:38px;padding:7px 16px;border:1px solid currentColor;border-radius:5px;background:transparent;color:inherit;cursor:pointer;font-weight:600}
.shoppingroute-review-button:disabled{opacity:.45;cursor:default}
.shoppingroute-review-list{display:flex;flex-direction:column;border:1px solid currentColor;border-radius:8px;overflow:hidden}
.shoppingroute-review-row{display:grid;grid-template-columns:minmax(190px,1.35fr) minmax(150px,1fr) minmax(125px,.8fr) minmax(155px,1fr) minmax(150px,1fr) minmax(130px,.8fr) 34px;gap:9px;align-items:center;padding:9px 10px;border-bottom:1px solid currentColor}
.shoppingroute-review-row:last-child{border-bottom:0}
.shoppingroute-review-row input,.shoppingroute-review-row select{width:100%;min-width:0;min-height:36px;box-sizing:border-box;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;padding:6px 8px}
.shoppingroute-review-row select[multiple]{min-height:58px}
.shoppingroute-review-product small{display:block;opacity:.65;margin-top:3px;word-break:break-word}
.shoppingroute-review-delete{width:32px;height:32px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer}
.shoppingroute-review-head{font-size:.78rem;font-weight:700;opacity:.68;padding-top:6px;padding-bottom:6px}
@media(max-width:900px){
 .shoppingroute-review-head{display:none}
 .shoppingroute-review-row{grid-template-columns:1fr 1fr;padding:12px}
 .shoppingroute-review-product{grid-column:1/-1}
 .shoppingroute-review-delete{justify-self:end}
}
@media(max-width:600px){
 .shoppingroute-review-row{grid-template-columns:1fr}
 .shoppingroute-review-product,.shoppingroute-review-delete{grid-column:auto}
 .shoppingroute-review-delete{justify-self:start}
 .shoppingroute-review-button{width:100%}
}
`;

class ReviewEditor extends React.Component {
    change(data) {
        this.props.onChange(data, true);
    }

    update(index, patch) {
        this.change(updateReviewRow(this.props.data || {}, index, patch));
    }

    accept(index) {
        const staged = updateReviewRow(this.props.data || {}, index, { action: 'accept' });
        this.change(acceptReviewRows(staged, [index]));
    }

    acceptAll() {
        const rows = Array.isArray(this.props.data?.reviewItems) ? this.props.data.reviewItems : [];
        const indexes = rows.map((_, index) => index).filter(index => rows[index]?.action !== 'accepted');
        if (indexes.length) this.change(acceptReviewRows(this.props.data || {}, indexes));
    }

    remove(index) {
        const data = this.props.data || {};
        const reviewItems = (Array.isArray(data.reviewItems) ? data.reviewItems : [])
            .filter((_, rowIndex) => rowIndex !== index)
            .map(row => ({ ...row }));
        this.change({ ...data, reviewItems });
    }

    renderRow(row, index, groups, markets) {
        const available = new Set(String(row.availableMarkets || '').split(/[;,]/).map(value => keyOf(value)).filter(Boolean));
        const accepted = row.action === 'accepted';
        const statusOptions = [
            h('option', { key: 'pending', value: 'pending' }, text('Offen', 'Pending')),
            h('option', { key: 'accept', value: 'accept' }, text('Übernehmen', 'Accept')),
            accepted ? h('option', { key: 'accepted', value: 'accepted' }, text('Übernommen', 'Accepted')) : null,
            h('option', { key: 'ignore', value: 'ignore' }, text('Ignorieren', 'Ignore')),
        ].filter(Boolean);
        const rowStyle = accepted ? { opacity: 0.78 } : undefined;
        return h('div', { key: `${row.key || row.product || 'review'}-${index}`, className: 'shoppingroute-review-row', style: rowStyle }, [
            h('div', { key: 'product', className: 'shoppingroute-review-product' }, [
                h('input', {
                    key: 'input',
                    value: String(row.product || ''),
                    'aria-label': text('Artikel', 'Product'),
                    onChange: event => this.update(index, { product: event.target.value, action: accepted ? 'pending' : row.action }),
                }),
                h('small', { key: 'source' }, String(row.text || '')),
            ]),
            h('select', {
                key: 'category',
                value: String(row.category || row.guessedCategory || ''),
                'aria-label': text('Produktgruppe', 'Product group'),
                onChange: event => this.update(index, { category: event.target.value, action: accepted ? 'pending' : row.action }),
            }, [...new Set([String(row.category || row.guessedCategory || ''), ...groups].filter(Boolean))].map(group => h('option', { key: group, value: group }, group))),
            h('select', {
                key: 'defaultMarket',
                value: String(row.defaultMarket || ''),
                'aria-label': text('Standardmarkt', 'Default market'),
                onChange: event => this.update(index, { defaultMarket: event.target.value, action: accepted ? 'pending' : row.action }),
            }, [h('option', { key: '__none__', value: '' }, '—'), ...markets.map(market => h('option', { key: market, value: market }, market))]),
            h('select', {
                key: 'availableMarkets',
                multiple: true,
                value: markets.filter(market => available.has(keyOf(market))),
                'aria-label': text('Verfügbare Märkte', 'Available markets'),
                onChange: event => {
                    const values = [...event.target.selectedOptions].map(option => option.value);
                    this.update(index, { availableMarkets: values.join(','), action: accepted ? 'pending' : row.action });
                },
            }, markets.map(market => h('option', { key: market, value: market }, market))),
            h('input', {
                key: 'aliases',
                value: String(row.aliases || ''),
                placeholder: text('Aliase', 'Aliases'),
                'aria-label': text('Aliase', 'Aliases'),
                onChange: event => this.update(index, { aliases: event.target.value, action: accepted ? 'pending' : row.action }),
            }),
            h('select', {
                key: 'action',
                value: String(row.action || 'pending'),
                'aria-label': text('Aktion', 'Action'),
                onChange: event => {
                    if (event.target.value === 'accept') this.accept(index);
                    else this.update(index, { action: event.target.value });
                },
            }, statusOptions),
            h('button', {
                key: 'delete',
                type: 'button',
                className: 'shoppingroute-review-delete',
                title: text('Aus Prüfliste entfernen', 'Remove from review list'),
                onClick: () => this.remove(index),
            }, '×'),
        ]);
    }

    render() {
        const data = this.props.data || {};
        const rows = Array.isArray(data.reviewItems) ? data.reviewItems : [];
        const groups = productGroups(data);
        const markets = activeMarkets(data);
        const pendingCount = rows.filter(row => row?.action !== 'accepted').length;
        const children = [h('style', { key: 'styles' }, styles)];
        children.push(h('div', { key: 'toolbar', className: 'shoppingroute-review-toolbar' }, [
            h('button', {
                key: 'acceptAll',
                type: 'button',
                className: 'shoppingroute-review-button',
                disabled: pendingCount === 0,
                onClick: () => this.acceptAll(),
            }, pendingCount ? text(`Alle übernehmen (${pendingCount})`, `Accept all (${pendingCount})`) : text('Alles übernommen', 'All accepted')),
            h('span', { key: 'hint', style: { opacity: 0.7 } }, text('„Übernehmen“ aktualisiert Artikelstamm und Status sofort; danach normal speichern.', '“Accept” updates catalogue and status immediately; then save normally.')),
        ]));
        if (!rows.length) {
            children.push(h('div', { key: 'empty', style: { opacity: 0.7, padding: '12px 0' } }, text('Keine unbekannten Artikel vorhanden.', 'No unknown products.')));
            return h('div', { style: { width: '100%' } }, children);
        }
        children.push(h('div', { key: 'list', className: 'shoppingroute-review-list' }, [
            h('div', { key: 'head', className: 'shoppingroute-review-row shoppingroute-review-head' }, [
                h('div', { key: 'product' }, text('Artikel / Alexa-Text', 'Product / Alexa text')),
                h('div', { key: 'group' }, text('Produktgruppe', 'Product group')),
                h('div', { key: 'default' }, text('Standardmarkt', 'Default market')),
                h('div', { key: 'available' }, text('Verfügbare Märkte', 'Available markets')),
                h('div', { key: 'aliases' }, text('Aliase', 'Aliases')),
                h('div', { key: 'action' }, text('Status', 'Status')),
                h('div', { key: 'delete' }, ''),
            ]),
            ...rows.map((row, index) => this.renderRow(row || {}, index, groups, markets)),
        ]));
        return h('div', { style: { width: '100%' } }, children);
    }
}

module.exports = {
    Components: { ReviewEditor },
    ReviewEditorModel: {
        normalizeMarketCsv,
        updateReviewRow,
        acceptReviewRows,
        findProductIndex,
    },
};
