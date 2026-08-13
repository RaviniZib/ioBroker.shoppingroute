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
const ciCompare = (a, b) => String(a || '').localeCompare(String(b || ''), 'de', { sensitivity: 'base' });
const sameMarket = (a, b) => keyOf(a) === keyOf(b);

function activeMarkets(data) {
    return (Array.isArray(data && data.markets) ? data.markets : [])
        .filter(market => market && market.name && market.enabled !== false)
        .map(market => String(market.name).trim())
        .filter(Boolean)
        .filter((market, index, all) => all.findIndex(other => sameMarket(other, market)) === index)
        .sort(ciCompare);
}

function marketRoutes(routes, market) {
    return (Array.isArray(routes) ? routes : [])
        .map((route, originalIndex) => ({ route, originalIndex }))
        .filter(
            entry => entry.route && sameMarket(entry.route.market, market) && String(entry.route.category || '').trim(),
        )
        .sort((a, b) => {
            const ao = Number(a.route.order) || 999999;
            const bo = Number(b.route.order) || 999999;
            return ao - bo || a.originalIndex - b.originalIndex;
        })
        .map(entry => ({ ...entry.route, category: String(entry.route.category).trim() }));
}

function availableProductGroups(productGroups, routes, market) {
    const used = new Set(marketRoutes(routes, market).map(route => keyOf(route.category)));
    const seen = new Set();
    return (Array.isArray(productGroups) ? productGroups : [])
        .map(group => String((group && group.name) || '').trim())
        .filter(name => {
            const key = keyOf(name);
            if (!key || used.has(key) || seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        })
        .sort(ciCompare);
}

function replaceMarketRoutes(routes, market, selectedRoutes) {
    const source = Array.isArray(routes) ? routes : [];
    const replacement = (Array.isArray(selectedRoutes) ? selectedRoutes : [])
        .filter(route => route && String(route.category || '').trim())
        .map((route, index) => ({
            market: String(market || '').trim(),
            category: String(route.category).trim(),
            order: (index + 1) * 10,
        }));
    const result = [];
    let inserted = false;

    for (const route of source) {
        if (route && sameMarket(route.market, market)) {
            if (!inserted) {
                result.push(...replacement);
                inserted = true;
            }
            continue;
        }
        result.push(route);
    }
    if (!inserted) {
        result.push(...replacement);
    }
    return result;
}

function moveMarketRoute(routes, market, fromIndex, direction) {
    const selected = marketRoutes(routes, market);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= selected.length || toIndex >= selected.length) {
        return routes;
    }
    [selected[fromIndex], selected[toIndex]] = [selected[toIndex], selected[fromIndex]];
    return replaceMarketRoutes(routes, market, selected);
}

function removeMarketRoute(routes, market, index) {
    const selected = marketRoutes(routes, market);
    if (index < 0 || index >= selected.length) {
        return routes;
    }
    selected.splice(index, 1);
    return replaceMarketRoutes(routes, market, selected);
}

function addMarketRoute(routes, market, category) {
    const name = String(category || '').trim();
    if (!name) {
        return routes;
    }
    const selected = marketRoutes(routes, market);
    if (selected.some(route => keyOf(route.category) === keyOf(name))) {
        return routes;
    }
    selected.push({ market: String(market || '').trim(), category: name, order: 0 });
    return replaceMarketRoutes(routes, market, selected);
}

class RouteEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = { selectedMarket: activeMarkets(props.data)[0] || '', selectedAddCategory: '' };
    }

    componentDidUpdate(prevProps) {
        if (prevProps.data === this.props.data) {
            return;
        }
        const markets = activeMarkets(this.props.data);
        if (!markets.some(market => sameMarket(market, this.state.selectedMarket))) {
            const selectedMarket = markets[0] || '';
            if (selectedMarket !== this.state.selectedMarket) {
                this.setState({ selectedMarket, selectedAddCategory: '' });
            }
        }
    }

    updateRoutes(routes) {
        this.props.onChange({ ...(this.props.data || {}), routes }, true);
    }

    move(index, direction) {
        this.updateRoutes(
            moveMarketRoute(this.props.data && this.props.data.routes, this.state.selectedMarket, index, direction),
        );
    }

    remove(index) {
        this.updateRoutes(
            removeMarketRoute(this.props.data && this.props.data.routes, this.state.selectedMarket, index),
        );
    }

    add(available) {
        const category = available.some(name => keyOf(name) === keyOf(this.state.selectedAddCategory))
            ? this.state.selectedAddCategory
            : available[0];
        if (!category) {
            return;
        }
        this.updateRoutes(
            addMarketRoute(this.props.data && this.props.data.routes, this.state.selectedMarket, category),
        );
        this.setState({ selectedAddCategory: '' });
    }

    render() {
        const data = this.props.data || {};
        const markets = activeMarkets(data);
        const selectedMarket = this.state.selectedMarket;
        const routes = marketRoutes(data.routes, selectedMarket);
        const available = availableProductGroups(data.productGroups, data.routes, selectedMarket);
        const addCategory = available.some(name => keyOf(name) === keyOf(this.state.selectedAddCategory))
            ? this.state.selectedAddCategory
            : available[0] || '';
        const catalog = new Set(
            (Array.isArray(data.productGroups) ? data.productGroups : [])
                .map(group => keyOf(group && group.name))
                .filter(Boolean),
        );
        const dark = String(this.props.themeType || '').toLowerCase() === 'dark';
        const border = dark ? '#555' : '#d5d5d5';
        const background = dark ? '#2b2b2b' : '#fff';
        const muted = dark ? '#bbb' : '#666';
        const buttonBackground = dark ? '#3b3b3b' : '#f4f4f4';
        const controlStyle = {
            minWidth: '240px',
            padding: '9px 12px',
            borderRadius: '4px',
            border: `1px solid ${border}`,
            background,
            color: 'inherit',
        };

        const children = [
            h(
                'div',
                {
                    key: 'selector',
                    style: {
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        alignItems: 'center',
                        marginBottom: '18px',
                    },
                },
                [
                    h(
                        'label',
                        { key: 'label', htmlFor: 'shoppingroute-route-market', style: { fontWeight: 600 } },
                        text('Markt auswählen:', 'Select market:'),
                    ),
                    h(
                        'select',
                        {
                            key: 'select',
                            id: 'shoppingroute-route-market',
                            value: selectedMarket,
                            onChange: event =>
                                this.setState({ selectedMarket: event.target.value, selectedAddCategory: '' }),
                            style: controlStyle,
                        },
                        markets.map(market => h('option', { key: market, value: market }, market)),
                    ),
                ],
            ),
        ];

        if (!markets.length) {
            children.push(
                h(
                    'div',
                    { key: 'no-markets', style: { color: muted, padding: '12px 0' } },
                    text('Noch keine aktiven Märkte vorhanden.', 'No active markets configured yet.'),
                ),
            );
            return h('div', { style: { width: '100%' } }, children);
        }

        children.push(
            h(
                'h3',
                { key: 'route-title', style: { margin: '0 0 6px' } },
                text('Laufweg dieses Marktes', 'Walking route for this market'),
            ),
        );
        children.push(
            h(
                'div',
                { key: 'hint', style: { color: muted, marginBottom: '10px', fontSize: '0.92rem' } },
                text(
                    'Oben beginnt der Laufweg. Änderungen betreffen ausschließlich den ausgewählten Markt.',
                    'The walking route starts at the top. Changes affect only the selected market.',
                ),
            ),
        );

        if (!routes.length) {
            children.push(
                h(
                    'div',
                    { key: 'no-routes', style: { color: muted, padding: '12px 0', marginBottom: '18px' } },
                    text(
                        'Für diesen Markt werden derzeit keine Produktgruppen verwendet.',
                        'No product groups are currently used for this market.',
                    ),
                ),
            );
        } else {
            children.push(
                h(
                    'div',
                    {
                        key: 'routes',
                        style: {
                            border: `1px solid ${border}`,
                            borderRadius: '6px',
                            overflow: 'hidden',
                            marginBottom: '18px',
                        },
                    },
                    routes.map((route, index) => {
                        const historical = !catalog.has(keyOf(route.category));
                        return h(
                            'div',
                            {
                                key: `${route.market}-${route.category}-${index}`,
                                style: {
                                    display: 'grid',
                                    gridTemplateColumns: '48px minmax(160px, 1fr) 144px',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '9px 12px',
                                    borderBottom: index < routes.length - 1 ? `1px solid ${border}` : 'none',
                                    background,
                                },
                            },
                            [
                                h(
                                    'div',
                                    {
                                        key: 'position',
                                        style: { color: muted, textAlign: 'right', paddingRight: '6px' },
                                    },
                                    String(index + 1),
                                ),
                                h('div', { key: 'category', style: { fontWeight: 500 } }, [
                                    String(route.category || ''),
                                    historical
                                        ? h(
                                              'div',
                                              {
                                                  key: 'historical',
                                                  style: { color: muted, fontSize: '0.8rem', fontWeight: 400 },
                                              },
                                              text(
                                                  'Nicht mehr im globalen Katalog',
                                                  'No longer in the global catalogue',
                                              ),
                                          )
                                        : null,
                                ]),
                                h(
                                    'div',
                                    {
                                        key: 'buttons',
                                        style: { display: 'flex', justifyContent: 'flex-end', gap: '6px' },
                                    },
                                    [
                                        h(
                                            'button',
                                            {
                                                key: 'up',
                                                type: 'button',
                                                disabled: index === 0,
                                                title: text('Nach oben', 'Move up'),
                                                onClick: () => this.move(index, -1),
                                                style: {
                                                    width: '38px',
                                                    height: '32px',
                                                    border: `1px solid ${border}`,
                                                    borderRadius: '4px',
                                                    background: buttonBackground,
                                                    color: 'inherit',
                                                    cursor: index === 0 ? 'default' : 'pointer',
                                                    opacity: index === 0 ? 0.4 : 1,
                                                },
                                            },
                                            '↑',
                                        ),
                                        h(
                                            'button',
                                            {
                                                key: 'down',
                                                type: 'button',
                                                disabled: index === routes.length - 1,
                                                title: text('Nach unten', 'Move down'),
                                                onClick: () => this.move(index, 1),
                                                style: {
                                                    width: '38px',
                                                    height: '32px',
                                                    border: `1px solid ${border}`,
                                                    borderRadius: '4px',
                                                    background: buttonBackground,
                                                    color: 'inherit',
                                                    cursor: index === routes.length - 1 ? 'default' : 'pointer',
                                                    opacity: index === routes.length - 1 ? 0.4 : 1,
                                                },
                                            },
                                            '↓',
                                        ),
                                        h(
                                            'button',
                                            {
                                                key: 'remove',
                                                type: 'button',
                                                title: text(
                                                    'Aus diesem Laufweg entfernen',
                                                    'Remove from this walking route',
                                                ),
                                                onClick: () => this.remove(index),
                                                style: {
                                                    width: '38px',
                                                    height: '32px',
                                                    border: `1px solid ${border}`,
                                                    borderRadius: '4px',
                                                    background: buttonBackground,
                                                    color: 'inherit',
                                                    cursor: 'pointer',
                                                },
                                            },
                                            '×',
                                        ),
                                    ],
                                ),
                            ],
                        );
                    }),
                ),
            );
        }

        children.push(
            h(
                'h3',
                { key: 'add-title', style: { margin: '0 0 8px' } },
                text('Produktgruppe hinzufügen', 'Add product group'),
            ),
        );
        if (!available.length) {
            children.push(
                h(
                    'div',
                    { key: 'no-available', style: { color: muted, padding: '8px 0' } },
                    text(
                        'Alle globalen Produktgruppen werden bereits in diesem Markt verwendet.',
                        'All global product groups are already used in this market.',
                    ),
                ),
            );
        } else {
            children.push(
                h(
                    'div',
                    {
                        key: 'add-controls',
                        style: { display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' },
                    },
                    [
                        h(
                            'select',
                            {
                                key: 'category',
                                value: addCategory,
                                onChange: event => this.setState({ selectedAddCategory: event.target.value }),
                                style: controlStyle,
                            },
                            available.map(category => h('option', { key: category, value: category }, category)),
                        ),
                        h(
                            'button',
                            {
                                key: 'add',
                                type: 'button',
                                onClick: () => this.add(available),
                                style: {
                                    minHeight: '38px',
                                    padding: '7px 16px',
                                    border: `1px solid ${border}`,
                                    borderRadius: '4px',
                                    background: buttonBackground,
                                    color: 'inherit',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                },
                            },
                            text('Hinzufügen', 'Add'),
                        ),
                    ],
                ),
            );
        }

        return h('div', { style: { width: '100%' } }, children);
    }
}

module.exports = {
    Components: { RouteEditor },
    RouteEditorModel: {
        activeMarkets,
        marketRoutes,
        availableProductGroups,
        replaceMarketRoutes,
        moveMarketRoute,
        removeMarketRoute,
        addMarketRoute,
    },
};
