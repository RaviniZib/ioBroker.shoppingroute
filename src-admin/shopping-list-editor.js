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

function stripVisiblePrefix(value) {
    let result = String(value || '').trim();
    for (let depth = 0; depth < 16; depth++) {
        const match = result.match(/^(?:\d{2}>|\[\d{2}\])\s+(.+)$/s);
        if (!match?.[1]) {
            break;
        }
        result = String(match[1]).trim();
    }
    return result;
}

function headerMarket(value, markets) {
    const visible = stripVisiblePrefix(value);
    const patterns = [/^═{5}\s+(.+?)\s+═{5}$/, /^\*\*\*\*\s+(.+?)\s+\*\*\*\*$/, /^[—–-]{1,5}\s+(.+?)\s+[—–-]{1,5}$/];
    let candidate = '';
    for (const pattern of patterns) {
        const match = visible.match(pattern);
        if (match?.[1]) {
            candidate = String(match[1]).trim();
            break;
        }
    }
    if (!candidate) {
        return '';
    }
    return (Array.isArray(markets) ? markets : []).find(market => keyOf(market) === keyOf(candidate)) || candidate;
}

function visibleItems(view) {
    const markets = Array.isArray(view?.markets) ? view.markets : [];
    return (Array.isArray(view?.items) ? view.items : [])
        .filter(item => item?.id && !headerMarket(item.text, markets))
        .map(item => ({ ...item, text: stripVisiblePrefix(item.text) }));
}

const responsiveStyles = `
.shoppingroute-list-toolbar{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-bottom:14px}
.shoppingroute-list-toolbar select,.shoppingroute-list-toolbar button{min-height:36px;box-sizing:border-box}
.shoppingroute-list-toolbar select{min-width:150px;padding:5px 8px}
.shoppingroute-market-grid{display:flex;flex-direction:column;gap:0}
.shoppingroute-market-column{min-width:0;border:1px solid currentColor;border-radius:8px;overflow:hidden}
.shoppingroute-market-title{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:9px 11px;font-weight:700;border-bottom:1px solid currentColor}
.shoppingroute-market-count{font-size:.82rem;opacity:.65;font-weight:500}
.shoppingroute-item-list{display:flex;flex-direction:column}
.shoppingroute-item-row{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 9px;border-bottom:1px solid currentColor}
.shoppingroute-item-row:last-child{border-bottom:0}
.shoppingroute-drag-handle{font-size:16px;opacity:.5;cursor:grab;user-select:none;text-align:center}
.shoppingroute-item-name{font-weight:600;word-break:break-word}
.shoppingroute-item-meta{font-size:.78rem;opacity:.62;margin-top:2px}
.shoppingroute-item-actions{display:flex;gap:4px;align-items:center;justify-content:flex-end}
.shoppingroute-list-button{min-width:30px;min-height:30px;padding:4px 8px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer}
.shoppingroute-list-button:disabled{cursor:default;opacity:.35}
.shoppingroute-item-actions select{min-width:92px;max-width:125px;min-height:30px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;padding:3px 5px}
.shoppingroute-empty{opacity:.58;padding:18px 11px;text-align:center}
@media (max-width: 600px) {
 .shoppingroute-list-toolbar>*{width:100%;max-width:none}
 .shoppingroute-item-row{grid-template-columns:18px minmax(0,1fr)}
 .shoppingroute-item-actions{grid-column:2;justify-content:flex-start;flex-wrap:wrap;margin-top:3px}
 .shoppingroute-item-actions select{flex:1 1 120px;max-width:none}
 .shoppingroute-drag-handle{cursor:default}
}
`;

class ShoppingListEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = { view: null, loading: true, busy: '', error: '' };
    }

    componentDidMount() {
        void this.load();
    }

    instanceName() {
        const adapter = String(this.props.adapterName || 'shoppingroute');
        const instance = Number.isFinite(Number(this.props.instance)) ? Number(this.props.instance) : 0;
        return `${adapter}.${instance}`;
    }

    async send(command, message) {
        if (!this.props.socket?.sendTo) {
            throw new Error('Admin socket is unavailable.');
        }
        return this.props.socket.sendTo(this.instanceName(), command, message || {});
    }

    async load(listName) {
        this.setState({ loading: true, error: '' });
        try {
            const result = await this.send('getShoppingList', { listName });
            if (!result || result.error) {
                throw new Error(result?.error || 'Shopping list could not be loaded.');
            }
            this.setState({ view: result, loading: false, busy: '' });
        } catch (error) {
            this.setState({ loading: false, busy: '', error: error instanceof Error ? error.message : String(error) });
        }
    }

    async move(itemId, targetMarket, targetPosition) {
        const view = this.state.view;
        if (!view || this.state.busy) {
            return;
        }
        this.setState({ busy: itemId, error: '' });
        try {
            const result = await this.send('moveShoppingItem', {
                listName: view.listName,
                itemId,
                targetMarket,
                targetPosition,
            });
            if (result?.view) {
                this.setState({ view: result.view });
            }
            if (!result?.ok) {
                throw new Error(result?.error || 'The item could not be moved.');
            }
            this.setState({ busy: '' });
        } catch (error) {
            this.setState({ busy: '', error: error instanceof Error ? error.message : String(error) });
            await this.load(view.listName);
        }
    }

    async clearManual() {
        const view = this.state.view;
        if (!view || this.state.busy) {
            return;
        }
        this.setState({ busy: '__clear__', error: '' });
        try {
            const result = await this.send('clearManualShoppingOrder', { listName: view.listName });
            if (result?.view) {
                this.setState({ view: result.view });
            }
            if (!result?.ok) {
                throw new Error(result?.error || 'Manual order could not be cleared.');
            }
            this.setState({ busy: '' });
        } catch (error) {
            this.setState({ busy: '', error: error instanceof Error ? error.message : String(error) });
            await this.load(view.listName);
        }
    }

    onDragStart(event, itemId) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', itemId);
    }

    onDrop(event, market, position) {
        event.preventDefault();
        const itemId = event.dataTransfer.getData('text/plain');
        if (itemId) {
            void this.move(itemId, market, position);
        }
    }

    renderRow(item, marketItems, index, view, allItems) {
        const busy = Boolean(this.state.busy);
        return h(
            'div',
            {
                key: item.id,
                className: 'shoppingroute-item-row',
                draggable: !busy,
                onDragStart: event => this.onDragStart(event, item.id),
                onDragOver: event => event.preventDefault(),
                onDrop: event => this.onDrop(event, item.market, index),
            },
            [
                h(
                    'div',
                    {
                        key: 'drag',
                        className: 'shoppingroute-drag-handle',
                        title: text('Ziehen', 'Drag'),
                        'aria-hidden': true,
                    },
                    '⋮⋮',
                ),
                h('div', { key: 'main' }, [
                    h('div', { key: 'name', className: 'shoppingroute-item-name' }, stripVisiblePrefix(item.text)),
                    item.category || item.manual
                        ? h('div', { key: 'meta', className: 'shoppingroute-item-meta' }, [
                              item.category || text('Ohne Produktgruppe', 'No product group'),
                              item.manual ? ` · ${text('manuell', 'manual')}` : '',
                          ])
                        : null,
                ]),
                h('div', { key: 'actions', className: 'shoppingroute-item-actions' }, [
                    h(
                        'button',
                        {
                            key: 'up',
                            type: 'button',
                            className: 'shoppingroute-list-button',
                            disabled: busy || index === 0,
                            title: text('Nach oben', 'Move up'),
                            onClick: () => void this.move(item.id, item.market, index - 1),
                        },
                        '↑',
                    ),
                    h(
                        'button',
                        {
                            key: 'down',
                            type: 'button',
                            className: 'shoppingroute-list-button',
                            disabled: busy || index === marketItems.length - 1,
                            title: text('Nach unten', 'Move down'),
                            onClick: () => void this.move(item.id, item.market, index + 1),
                        },
                        '↓',
                    ),
                    h(
                        'select',
                        {
                            key: 'market',
                            value: item.market,
                            disabled: busy,
                            title: text('Markt wechseln', 'Change market'),
                            'aria-label': text('In einen anderen Markt verschieben', 'Move to another market'),
                            onChange: event => {
                                const target = event.target.value;
                                const count = allItems.filter(
                                    entry => entry.market === target && entry.id !== item.id,
                                ).length;
                                void this.move(item.id, target, count);
                            },
                        },
                        view.markets.map(market => h('option', { key: market, value: market }, market)),
                    ),
                ]),
            ],
        );
    }

    render() {
        const view = this.state.view;
        const busy = Boolean(this.state.busy);
        const children = [h('style', { key: 'styles' }, responsiveStyles)];
        children.push(
            h('div', { key: 'intro', style: { marginBottom: '12px', lineHeight: 1.4 } }, [
                h('strong', { key: 'title' }, text('Aktuelle Einkaufsliste', 'Current shopping list')),
                h(
                    'div',
                    { key: 'hint', style: { opacity: 0.7, marginTop: '3px' } },
                    text(
                        'Ziehen verschiebt Artikel direkt. Pfeile und Marktauswahl sind die einfache Alternative für Maus und Handy.',
                        'Drag items directly. Arrows and the market selector are the simple alternative for mouse and phone.',
                    ),
                ),
            ]),
        );
        if (this.state.error) {
            children.push(
                h(
                    'div',
                    {
                        key: 'error',
                        style: {
                            padding: '9px',
                            border: '1px solid currentColor',
                            borderRadius: '6px',
                            marginBottom: '10px',
                        },
                    },
                    this.state.error,
                ),
            );
        }
        if (this.state.loading || !view) {
            children.push(h('div', { key: 'loading' }, text('Liste wird geladen …', 'Loading list …')));
            return h('div', { style: { width: '100%' } }, children);
        }

        const items = visibleItems(view);
        children.push(
            h('div', { key: 'toolbar', className: 'shoppingroute-list-toolbar' }, [
                h(
                    'select',
                    {
                        key: 'list',
                        value: view.listName,
                        disabled: busy,
                        onChange: event => void this.load(event.target.value),
                        'aria-label': text('Einkaufsliste auswählen', 'Select shopping list'),
                    },
                    view.lists.map(list => h('option', { key: list, value: list }, list)),
                ),
                h(
                    'button',
                    {
                        key: 'refresh',
                        type: 'button',
                        className: 'shoppingroute-list-button',
                        disabled: busy,
                        onClick: () => void this.load(view.listName),
                    },
                    text('Aktualisieren', 'Refresh'),
                ),
                h(
                    'button',
                    {
                        key: 'clear',
                        type: 'button',
                        className: 'shoppingroute-list-button',
                        disabled: busy,
                        onClick: () => void this.clearManual(),
                    },
                    text('Manuelle Reihenfolge zurücksetzen', 'Reset manual order'),
                ),
                view.dryRun
                    ? h(
                          'strong',
                          { key: 'dry', style: { marginLeft: 'auto' } },
                          text('Dry Run aktiv – Verschieben gesperrt', 'Dry Run active – moving is disabled'),
                      )
                    : null,
            ]),
        );

        const visibleMarkets = view.markets.filter(market => items.some(item => item.market === market));
        if (!visibleMarkets.length) {
            children.push(
                h(
                    'div',
                    { key: 'empty-list', style: { opacity: 0.7, padding: '16px 0' } },
                    text('Die Einkaufsliste ist leer.', 'The shopping list is empty.'),
                ),
            );
            return h('div', { style: { width: '100%' } }, children);
        }
        const columns = visibleMarkets.map(market => {
            const marketItems = items.filter(item => item.market === market);
            return h(
                'section',
                {
                    key: market,
                    className: 'shoppingroute-market-column',
                    onDragOver: event => event.preventDefault(),
                    onDrop: event => this.onDrop(event, market, marketItems.length),
                },
                [
                    h('div', { key: 'title', className: 'shoppingroute-market-title' }, [
                        h('span', { key: 'name' }, market),
                        h(
                            'span',
                            { key: 'count', className: 'shoppingroute-market-count' },
                            String(marketItems.length),
                        ),
                    ]),
                    marketItems.length
                        ? h(
                              'div',
                              { key: 'items', className: 'shoppingroute-item-list' },
                              marketItems.map((item, index) => this.renderRow(item, marketItems, index, view, items)),
                          )
                        : h(
                              'div',
                              { key: 'empty', className: 'shoppingroute-empty' },
                              text('Hierher ziehen', 'Drop here'),
                          ),
                ],
            );
        });
        children.push(h('div', { key: 'grid', className: 'shoppingroute-market-grid' }, columns));
        return h('div', { style: { width: '100%' } }, children);
    }
}

module.exports = {
    Components: { ShoppingListEditor },
    ShoppingListEditorModel: { stripVisiblePrefix, headerMarket, visibleItems },
    ShoppingListEditor,
};
