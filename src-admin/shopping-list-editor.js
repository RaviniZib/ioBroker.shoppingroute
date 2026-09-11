'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');
const h = React.createElement;

const text = (de, en) => {
    const language = typeof navigator !== 'undefined' ? String(navigator.language || '').toLowerCase() : 'de';
    return language.startsWith('de') ? de : en;
};

const responsiveStyles = `
    .shoppingroute-list-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-bottom: 14px;
    }
    .shoppingroute-list-toolbar select,
    .shoppingroute-list-toolbar button,
    .shoppingroute-card select {
        min-height: 38px;
        box-sizing: border-box;
    }
    .shoppingroute-market-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        align-items: start;
    }
    .shoppingroute-market-column {
        min-width: 0;
        border: 1px solid currentColor;
        border-radius: 8px;
        padding: 10px;
        opacity: 0.94;
    }
    .shoppingroute-card {
        border: 1px solid currentColor;
        border-radius: 6px;
        padding: 9px;
        margin: 8px 0;
        background: rgba(127, 127, 127, 0.08);
        cursor: grab;
    }
    .shoppingroute-card-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
        align-items: center;
    }
    .shoppingroute-card-controls select {
        min-width: 0;
        flex: 1 1 130px;
    }
    .shoppingroute-list-button {
        min-width: 38px;
        min-height: 34px;
        border: 1px solid currentColor;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }
    .shoppingroute-list-button:disabled {
        cursor: default;
        opacity: 0.4;
    }
    @media (max-width: 600px) {
        .shoppingroute-market-grid {
            grid-template-columns: 1fr;
        }
        .shoppingroute-list-toolbar > * {
            width: 100%;
            max-width: none;
        }
        .shoppingroute-card {
            cursor: default;
        }
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

    renderCard(item, marketItems, index, view) {
        const busy = Boolean(this.state.busy);
        return h(
            'div',
            {
                key: item.id,
                className: 'shoppingroute-card',
                draggable: !busy,
                onDragStart: event => this.onDragStart(event, item.id),
                onDragOver: event => event.preventDefault(),
                onDrop: event => this.onDrop(event, item.market, index),
                title: text('Ziehen oder die Schaltflächen benutzen', 'Drag or use the buttons'),
            },
            [
                h('div', { key: 'text', style: { fontWeight: 600, wordBreak: 'break-word' } }, item.text),
                h(
                    'div',
                    { key: 'meta', style: { fontSize: '0.82rem', opacity: 0.72, marginTop: '3px' } },
                    (item.category || text('Ohne Produktgruppe', 'No product group')) +
                        (item.manual ? ` · ${text('manuell', 'manual')}` : ''),
                ),
                h('div', { key: 'controls', className: 'shoppingroute-card-controls' }, [
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
                            'aria-label': text('In einen anderen Markt verschieben', 'Move to another market'),
                            onChange: event => {
                                const target = event.target.value;
                                const count = view.items.filter(
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
            h('div', { key: 'intro', style: { marginBottom: '12px', lineHeight: 1.45 } }, [
                h('strong', { key: 'title' }, text('Aktuelle Einkaufsliste', 'Current shopping list')),
                h(
                    'div',
                    { key: 'hint', style: { opacity: 0.75, marginTop: '3px' } },
                    text(
                        'Artikel können gezogen oder mit Pfeilen und Marktauswahl verschoben werden. Änderungen werden direkt in Alexa bestätigt.',
                        'Items can be dragged or moved with the arrows and market selector. Changes are confirmed directly in Alexa.',
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
        const columns = view.markets.map(market => {
            const items = view.items.filter(item => item.market === market);
            return h(
                'section',
                {
                    key: market,
                    className: 'shoppingroute-market-column',
                    onDragOver: event => event.preventDefault(),
                    onDrop: event => this.onDrop(event, market, items.length),
                },
                [
                    h('h3', { key: 'title', style: { margin: '0 0 6px' } }, `${market} (${items.length})`),
                    items.length
                        ? items.map((item, index) => this.renderCard(item, items, index, view))
                        : h(
                              'div',
                              { key: 'empty', style: { opacity: 0.62, padding: '12px 0' } },
                              text('Hierher ziehen', 'Drop here'),
                          ),
                ],
            );
        });
        children.push(h('div', { key: 'grid', className: 'shoppingroute-market-grid' }, columns));
        return h('div', { style: { width: '100%' } }, children);
    }
}

module.exports = { Components: { ShoppingListEditor }, ShoppingListEditor };
