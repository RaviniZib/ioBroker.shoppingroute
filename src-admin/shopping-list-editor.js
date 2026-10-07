'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');
const { DragHandle } = require('./shoppingroute-admin-ui');
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
        .map(item => ({ ...item, text: stripVisiblePrefix(item.text) }))
        .sort(
            (a, b) =>
                markets.indexOf(a.market) - markets.indexOf(b.market) ||
                Number(a.position || 0) - Number(b.position || 0),
        );
}

function optimisticMove(view, itemId, targetMarket, targetPosition) {
    const items = Array.isArray(view?.items) ? view.items.map(item => ({ ...item })) : [];
    const moving = items.find(item => item.id === itemId);
    if (!moving) {
        return view;
    }
    const sourceMarket = moving.market;
    const byPosition = (left, right) => Number(left.position || 0) - Number(right.position || 0);
    const sourceItems = items.filter(item => item.id !== itemId && item.market === sourceMarket).sort(byPosition);
    const targetItems =
        sourceMarket === targetMarket
            ? sourceItems
            : items.filter(item => item.id !== itemId && item.market === targetMarket).sort(byPosition);
    const requested = Number(targetPosition);
    const position = Math.max(
        0,
        Math.min(Number.isFinite(requested) ? requested : targetItems.length, targetItems.length),
    );
    targetItems.splice(position, 0, { ...moving, market: targetMarket, position, manual: true });
    const orderedById = new Map();
    if (sourceMarket !== targetMarket) {
        sourceItems.forEach((item, index) => orderedById.set(item.id, { ...item, position: index }));
    }
    targetItems.forEach((item, index) => orderedById.set(item.id, { ...item, position: index }));
    return { ...view, items: items.map(item => orderedById.get(item.id) || item) };
}

function validView(view) {
    return Boolean(
        view &&
        typeof view.listName === 'string' &&
        Array.isArray(view.lists) &&
        view.lists.every(list => typeof list === 'string') &&
        Array.isArray(view.markets) &&
        view.markets.every(market => typeof market === 'string') &&
        Array.isArray(view.items) &&
        view.items.every(
            item =>
                item && typeof item.id === 'string' && typeof item.text === 'string' && typeof item.market === 'string',
        ),
    );
}

function checkedView(view) {
    if (!validView(view)) {
        throw new Error(
            text(
                'Die Einkaufslistendaten sind unvollständig. Bitte erneut laden.',
                'The shopping-list data is incomplete. Please reload.',
            ),
        );
    }
    return view;
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
.shoppingroute-item-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:8px;align-items:center;padding:7px 9px;border-bottom:1px solid currentColor}
.shoppingroute-item-row:last-child{border-bottom:0}
.shoppingroute-drag-handle{font-size:16px;opacity:.5;cursor:grab;user-select:none;text-align:center}
.shoppingroute-item-name{font-weight:600;word-break:break-word}
.shoppingroute-item-meta{font-size:.78rem;opacity:.62;margin-top:2px}
.shoppingroute-item-actions{display:flex;gap:4px;align-items:center;justify-content:flex-end}
.shoppingroute-list-button{min-width:30px;min-height:30px;padding:4px 8px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer}
.shoppingroute-list-button:disabled{cursor:default;opacity:.35}
.shoppingroute-item-actions select{min-width:92px;max-width:125px;min-height:30px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;padding:3px 5px}
.shoppingroute-empty{opacity:.58;padding:18px 11px;text-align:center}\n.shoppingroute-progress-spinner{display:inline-block;width:16px;height:16px;margin-right:9px;vertical-align:-3px;border:3px solid currentColor;border-right-color:transparent;border-radius:50%;animation:shoppingroute-spin .8s linear infinite}\n@keyframes shoppingroute-spin{to{transform:rotate(360deg)}}
@media (max-width: 600px) {
 .shoppingroute-list-toolbar>*{width:100%;max-width:none;min-height:44px}
 .shoppingroute-list-button,.shoppingroute-item-actions select{min-height:44px;min-width:44px}
 .shoppingroute-item-row{grid-template-columns:44px minmax(0,1fr)}
 .shoppingroute-item-actions{grid-column:2;justify-content:flex-start;flex-wrap:wrap;margin-top:3px}
 .shoppingroute-item-actions select{flex:1 1 120px;max-width:none}
 .shoppingroute-drag-handle{cursor:default}
}
`;

function localizedMoveError(message) {
    const value = String(message || '');
    const known = {
        'Dry Run is active. Disable Dry Run before changing the Alexa list.':
            'Der Testmodus ist aktiv. Bitte vor dem Verschieben deaktivieren.',
        'ShoppingRoute is disabled.': 'ShoppingRoute ist deaktiviert.',
        'A shopping-list update is already running. Please try again.':
            'Die Einkaufsliste wird bereits bearbeitet. Bitte danach erneut versuchen.',
        'The selected shopping-list item no longer exists.': 'Der ausgewählte Artikel ist nicht mehr vorhanden.',
        'The selected target market is not available.': 'Der ausgewählte Zielmarkt ist nicht verfügbar.',
        'Move status is no longer available.': 'Der Status der Verschiebung ist nicht mehr verfügbar.',
    };
    return text(
        known[value] || 'Der Artikel konnte nicht verschoben werden. Bitte die Liste neu laden und erneut versuchen.',
        value || 'The item could not be moved. Please reload the list and try again.',
    );
}

class ShoppingListEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = { view: null, loading: true, busy: '', error: '', newItem: '', progress: '' };
        this.commandPending = false;
        this.visitedMarkets = new Set();
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

    async addItem() {
        const value = String(this.state.newItem || '').trim();
        if (!value || this.commandPending || !this.state.view || this.state.view.dryRun) {
            return;
        }
        this.commandPending = true;
        this.setState({ busy: 'add', error: '' });
        try {
            const result = await this.send('addShoppingItem', { listName: this.state.view.listName, text: value });
            if (!result?.ok) {
                throw new Error(result?.error || 'Adding the item failed.');
            }
            this.setState({ view: checkedView(result.view), newItem: '', busy: '' });
        } catch (error) {
            this.setState({ busy: '', error: error instanceof Error ? error.message : String(error) });
        } finally {
            this.commandPending = false;
        }
    }

    async load(listName) {
        this.setState({ loading: true, error: '' });
        try {
            const result = await this.send('getShoppingList', { listName });
            if (!result || result.error) {
                throw new Error(result?.error || 'Shopping list could not be loaded.');
            }
            this.setState({ view: checkedView(result), loading: false, busy: '' });
            result.items.forEach(item => this.visitedMarkets.add(item.market));
        } catch (error) {
            this.setState({ loading: false, busy: '', error: error instanceof Error ? error.message : String(error) });
        }
    }

    async waitForMove(requestId) {
        for (let attempt = 0; attempt < 300; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const status = await this.send('getShoppingMoveStatus', { requestId });
            if (!status?.pending) {
                return status;
            }
        }
        throw new Error('Move status timed out.');
    }

    async move(itemId, targetMarket, targetPosition) {
        const view = this.state.view;
        if (!view || this.commandPending || this.state.busy) {
            return;
        }
        const item = view.items.find(entry => entry.id === itemId);
        const sourceMarket = item?.market || '';
        if (!item || (sourceMarket === targetMarket && Number(item.position) === Number(targetPosition))) {
            return;
        }
        this.visitedMarkets.add(sourceMarket);
        this.visitedMarkets.add(targetMarket);
        this.commandPending = true;
        this.setState({
            view: optimisticMove(view, itemId, targetMarket, targetPosition),
            busy: itemId,
            error: '',
            progress: text(
                `„${item?.text || 'Artikel'}“ wird von ${sourceMarket || 'der bisherigen Zuordnung'} nach ${targetMarket} verschoben. Alexa sortiert und bestätigt jetzt die Einkaufsliste. Das kann mehrere Minuten dauern – bitte diese Seite geöffnet lassen.`,
                `Moving “${item?.text || 'item'}” from ${sourceMarket || 'its current assignment'} to ${targetMarket}. Alexa is sorting and confirming the shopping list now. This can take several minutes — please keep this page open.`,
            ),
        });
        try {
            const requestId = `${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
            let result = await this.send('moveShoppingItem', {
                listName: view.listName,
                itemId,
                itemText: item.text,
                targetMarket,
                targetPosition,
                requestId,
            });
            if (result?.pending) {
                result = await this.waitForMove(requestId);
            }
            if (result?.view) {
                this.setState({ view: checkedView(result.view) });
            }
            if (!result?.ok) {
                throw new Error(result?.error || 'The item could not be moved.');
            }
            this.setState({ busy: '', progress: '' });
        } catch (error) {
            const message = localizedMoveError(error instanceof Error ? error.message : String(error));
            await this.load(view.listName);
            this.setState({ busy: '', progress: '', error: message });
        } finally {
            this.commandPending = false;
        }
    }

    async remove(itemId) {
        const view = this.state.view;
        if (!view || view.dryRun || this.commandPending || this.state.busy) {
            return;
        }
        this.commandPending = true;
        this.setState({ busy: itemId, error: '' });
        try {
            const result = await this.send('deleteShoppingItem', { listName: view.listName, itemId });
            if (result?.view) {
                this.setState({ view: checkedView(result.view) });
            }
            if (!result?.ok) {
                throw new Error(result?.error || 'The item could not be deleted.');
            }
            this.setState({ busy: '' });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.load(view.listName);
            this.setState({ busy: '', error: message });
        } finally {
            this.commandPending = false;
        }
    }

    async clearManual() {
        const view = this.state.view;
        if (!view || this.commandPending || this.state.busy) {
            return;
        }
        this.commandPending = true;
        this.setState({ busy: '__clear__', error: '' });
        try {
            const result = await this.send('clearManualShoppingOrder', { listName: view.listName });
            if (result?.view) {
                this.setState({ view: checkedView(result.view) });
            }
            if (!result?.ok) {
                throw new Error(result?.error || 'Manual order could not be cleared.');
            }
            this.setState({ busy: '' });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await this.load(view.listName);
            this.setState({ busy: '', error: message });
        } finally {
            this.commandPending = false;
        }
    }

    onDragStart(event, itemId) {
        this.dragItemId = itemId;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', itemId);
    }

    onDrop(event, market, position) {
        event.preventDefault();
        event.stopPropagation();
        const itemId = event.dataTransfer?.getData('text/plain') || this.dragItemId;
        this.dragItemId = null;
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
                'data-drop-index': index,
                onDragEnd: () => {
                    this.dragItemId = null;
                },
                onDragStart: event => this.onDragStart(event, item.id),
                onDragOver: event => event.preventDefault(),
                onDrop: event => {
                    const moving = view.items.find(entry => entry.id === this.dragItemId);
                    const from = moving?.market === item.market ? moving.position : -1;
                    const rect = event.currentTarget?.getBoundingClientRect?.();
                    const slot = rect && event.clientY >= rect.top + rect.height / 2 ? index + 1 : index;
                    this.onDrop(event, item.market, Math.max(0, slot - (from >= 0 && from < slot ? 1 : 0)));
                },
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
                    h(DragHandle, {
                        scope: 'shopping',
                        length: marketItems.length,
                        index,
                        market: item.market,
                        disabled: busy || view.dryRun,
                        onStart: () => {
                            this.dragItemId = item.id;
                        },
                        onDrop: (target, market) => {
                            void this.move(item.id, market || item.market, target);
                        },
                        onEnd: () => {
                            this.dragItemId = null;
                        },
                    }),
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
                        'button',
                        {
                            key: 'delete',
                            type: 'button',
                            className: 'shoppingroute-list-button',
                            disabled: busy || view.dryRun,
                            title: text('Aus der Alexa-Einkaufsliste löschen', 'Delete from the Alexa shopping list'),
                            'aria-label': `${text('Artikel löschen', 'Delete item')}: ${stripVisiblePrefix(item.text)}`,
                            onClick: () => void this.remove(item.id),
                        },
                        text('Löschen', 'Delete'),
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
        const view = validView(this.state.view) ? this.state.view : null;
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
        if (this.state.progress) {
            children.push(
                h(
                    'div',
                    {
                        key: 'progress',
                        role: 'status',
                        'aria-live': 'polite',
                        style: {
                            padding: '12px',
                            border: '2px solid #1976d2',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            background: 'rgba(25,118,210,.12)',
                            fontWeight: 700,
                            lineHeight: 1.45,
                        },
                    },
                    [
                        h('span', {
                            key: 'spinner',
                            className: 'shoppingroute-progress-spinner',
                            'aria-hidden': 'true',
                        }),
                        this.state.progress,
                    ],
                ),
            );
        }
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
        if (this.state.loading) {
            children.push(h('div', { key: 'loading' }, text('Liste wird geladen …', 'Loading list …')));
            return h('div', { style: { width: '100%' } }, children);
        }
        if (!view) {
            if (!this.state.error) {
                children.push(
                    h(
                        'div',
                        { key: 'invalid' },
                        text('Die Einkaufslistendaten sind unvollständig.', 'The shopping-list data is incomplete.'),
                    ),
                );
            }
            children.push(
                h(
                    'button',
                    {
                        key: 'retry',
                        type: 'button',
                        className: 'shoppingroute-list-button',
                        onClick: () => this.load(),
                    },
                    text('Erneut laden', 'Reload'),
                ),
            );
            return h('div', { style: { width: '100%' } }, children);
        }

        const items = visibleItems(view);
        children.push(
            h('div', { key: 'toolbar', className: 'shoppingroute-list-toolbar' }, [
                h('input', {
                    key: 'new-item',
                    type: 'text',
                    value: this.state.newItem || '',
                    maxLength: 500,
                    disabled: busy || view.dryRun,
                    placeholder: text('Neuen Artikel hinzufügen', 'Add a new item'),
                    'aria-label': text('Neuer Artikel', 'New item'),
                    onChange: event => this.setState({ newItem: event.target.value }),
                    onKeyDown: event => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void this.addItem();
                        }
                    },
                }),
                h(
                    'button',
                    {
                        key: 'add-item',
                        type: 'button',
                        className: 'shoppingroute-list-button',
                        disabled: busy || view.dryRun || !String(this.state.newItem || '').trim(),
                        onClick: () => void this.addItem(),
                    },
                    text('Hinzufügen', 'Add'),
                ),
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
                          text('Dry Run aktiv – Änderungen gesperrt', 'Dry Run active – changes are disabled'),
                      )
                    : null,
            ]),
        );

        children.push(
            h(
                'button',
                {
                    key: 'empty-markets',
                    className: 'shoppingroute-list-button',
                    style: { marginBottom: '12px' },
                    disabled: busy,
                    onClick: () => this.setState({ showEmptyMarkets: !this.state.showEmptyMarkets }),
                },
                this.state.showEmptyMarkets
                    ? text('Leere Märkte ausblenden', 'Hide empty markets')
                    : text('Weitere Märkte als Ablageziel anzeigen', 'Show other markets as drop targets'),
            ),
        );
        const visibleMarkets = view.markets.filter(
            market =>
                this.state.showEmptyMarkets ||
                this.visitedMarkets.has(market) ||
                items.some(item => item.market === market),
        );
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
                    'data-sort-scope': 'shopping',
                    'data-drop-market': market,
                    'data-drop-length': marketItems.length,
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
                        ? h('div', { key: 'items', className: 'shoppingroute-item-list' }, [
                              ...marketItems.map((item, index) =>
                                  this.renderRow(item, marketItems, index, view, items),
                              ),
                              h(
                                  'div',
                                  {
                                      key: 'drop-end',
                                      className: 'shoppingroute-empty',
                                      'data-drop-index': marketItems.length,
                                      'data-drop-end': true,
                                      style: { minHeight: '48px', borderTop: '1px dashed currentColor' },
                                      onDragOver: event => event.preventDefault(),
                                      onDrop: event =>
                                          this.onDrop(
                                              event,
                                              market,
                                              marketItems.filter(item => item.id !== this.dragItemId).length,
                                          ),
                                  },
                                  text('Hier ans Ende ziehen', 'Drop here at the end'),
                              ),
                          ])
                        : h(
                              'div',
                              {
                                  key: 'empty',
                                  className: 'shoppingroute-empty',
                                  'data-drop-index': 0,
                                  'data-drop-end': true,
                              },
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
    ShoppingListEditorModel: { stripVisiblePrefix, headerMarket, visibleItems, optimisticMove },
    ShoppingListEditor,
};
