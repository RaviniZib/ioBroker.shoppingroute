'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');
const {
    ActionButton,
    AddControls,
    BorderedList,
    EditorFrame,
    EditorRow,
    IconButton,
    SectionHeading,
    TextInput,
    text,
    themeTokens,
} = require('./shoppingroute-admin-ui');

const h = React.createElement;

const marketResponsiveStyles = `
    .shoppingroute-markets-fields {
        display: grid;
        grid-template-columns: minmax(72px, 96px) minmax(96px, 128px) minmax(180px, 1fr) minmax(180px, 1.4fr);
        gap: 10px;
        align-items: center;
    }
    @media (max-width: 900px) {
        .shoppingroute-markets-fields {
            grid-template-columns: minmax(72px, 96px) minmax(96px, 128px) minmax(180px, 1fr);
        }
        .shoppingroute-markets-aliases {
            grid-column: 1 / -1;
        }
    }
    @media (max-width: 600px) {
        .shoppingroute-markets-fields {
            grid-template-columns: 1fr;
        }
        .shoppingroute-markets-aliases {
            grid-column: auto;
        }
    }
`;

function FieldGrid({ children }) {
    return h('div', { className: 'shoppingroute-markets-fields' }, children);
}

function Field({ children, className, label, tokens }) {
    return h('label', { className, style: { display: 'flex', minWidth: 0, flexDirection: 'column', gap: '4px' } }, [
        h('span', { key: 'label', style: { color: tokens.muted, fontSize: '0.78rem' } }, label),
        children,
    ]);
}

function CheckboxField({ checked, label, onChange, tokens }) {
    return h(
        'label',
        { style: { display: 'flex', alignItems: 'center', gap: '8px', minHeight: '38px', color: 'inherit' } },
        [
            h('input', {
                key: 'input',
                type: 'checkbox',
                checked,
                onChange,
                style: { width: '18px', height: '18px', accentColor: '#3399cc' },
            }),
            h('span', { key: 'label', style: { color: tokens.muted } }, label),
        ],
    );
}

function NumberInput({ ariaLabel, onChange, tokens, value }) {
    return h('input', {
        className: 'shoppingroute-editor-control',
        type: 'number',
        value,
        'aria-label': ariaLabel,
        onChange,
        style: {
            width: '100%',
            padding: '9px 12px',
            borderRadius: '4px',
            border: `1px solid ${tokens.border}`,
            background: tokens.background,
            color: 'inherit',
        },
    });
}

function marketRows(markets) {
    return (Array.isArray(markets) ? markets : []).map(market => {
        if (market && typeof market === 'object' && !Array.isArray(market)) {
            return { ...market };
        }
        return { enabled: true, order: 999, name: String(market || ''), aliases: '' };
    });
}

function nextMarketOrder(markets) {
    const orders = marketRows(markets)
        .map(market => Number(market.order))
        .filter(Number.isFinite);
    return orders.length ? Math.max(...orders) + 10 : 10;
}

function addMarket(markets, name) {
    const value = String(name || '').trim();
    const result = marketRows(markets);
    if (value) {
        result.push({ enabled: true, order: nextMarketOrder(result), name: value, aliases: '' });
    }
    return result;
}

function editMarket(markets, index, patch) {
    const result = marketRows(markets);
    if (index >= 0 && index < result.length) {
        result[index] = { ...result[index], ...patch };
    }
    return result;
}

function removeMarket(markets, index) {
    const result = marketRows(markets);
    if (index >= 0 && index < result.length) {
        result.splice(index, 1);
    }
    return result;
}

function moveMarket(markets, fromIndex, direction) {
    const result = marketRows(markets);
    const toIndex = fromIndex + direction;
    if (fromIndex >= 0 && fromIndex < result.length && toIndex >= 0 && toIndex < result.length) {
        [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
    }
    return result;
}

class MarketsEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = { newName: '' };
    }

    updateMarkets(markets) {
        this.props.onChange({ ...(this.props.data || {}), markets }, true);
    }

    add() {
        const next = addMarket(this.props.data && this.props.data.markets, this.state.newName);
        if (next.length === marketRows(this.props.data && this.props.data.markets).length) {
            return;
        }
        this.updateMarkets(next);
        this.setState({ newName: '' });
    }

    edit(index, patch) {
        this.updateMarkets(editMarket(this.props.data && this.props.data.markets, index, patch));
    }

    remove(index) {
        this.updateMarkets(removeMarket(this.props.data && this.props.data.markets, index));
    }

    move(index, direction) {
        this.updateMarkets(moveMarket(this.props.data && this.props.data.markets, index, direction));
    }

    renderMarketRow(market, index, markets, tokens) {
        return h(
            EditorRow,
            {
                key: index,
                position: index + 1,
                last: index === markets.length - 1,
                tokens,
                actions: [
                    h(
                        IconButton,
                        {
                            key: 'up',
                            disabled: index === 0,
                            onClick: () => this.move(index, -1),
                            title: text('Nach oben', 'Move up'),
                            tokens,
                        },
                        '↑',
                    ),
                    h(
                        IconButton,
                        {
                            key: 'down',
                            disabled: index === markets.length - 1,
                            onClick: () => this.move(index, 1),
                            title: text('Nach unten', 'Move down'),
                            tokens,
                        },
                        '↓',
                    ),
                    h(
                        IconButton,
                        {
                            key: 'remove',
                            onClick: () => this.remove(index),
                            title: text('Markt löschen', 'Delete market'),
                            tokens,
                        },
                        '×',
                    ),
                ],
            },
            h(FieldGrid, null, [
                h(CheckboxField, {
                    key: 'enabled',
                    checked: market.enabled !== false,
                    label: text('Aktiv', 'Active'),
                    onChange: event => this.edit(index, { enabled: event.target.checked }),
                    tokens,
                }),
                h(
                    Field,
                    { key: 'order', label: text('Reihenfolge', 'Order'), tokens },
                    h(NumberInput, {
                        ariaLabel: text('Reihenfolge bearbeiten', 'Edit order'),
                        onChange: event => this.edit(index, { order: Number(event.target.value) }),
                        tokens,
                        value: market.order == null ? '' : String(market.order),
                    }),
                ),
                h(
                    Field,
                    { key: 'name', label: text('Markt', 'Market'), tokens },
                    h(TextInput, {
                        ariaLabel: text('Marktnamen bearbeiten', 'Edit market name'),
                        onChange: event => this.edit(index, { name: event.target.value }),
                        tokens,
                        value: String(market.name || ''),
                    }),
                ),
                h(
                    Field,
                    {
                        key: 'aliases',
                        className: 'shoppingroute-markets-aliases',
                        label: text('Aliase', 'Aliases'),
                        tokens,
                    },
                    h(TextInput, {
                        ariaLabel: text('Aliase bearbeiten', 'Edit aliases'),
                        onChange: event => this.edit(index, { aliases: event.target.value }),
                        placeholder: text('Kommagetrennte Namen', 'Comma-separated names'),
                        tokens,
                        value: String(market.aliases || ''),
                    }),
                ),
            ]),
        );
    }

    render() {
        const markets = marketRows(this.props.data && this.props.data.markets);
        const tokens = themeTokens(this.props.themeType);
        const children = [
            h('style', { key: 'markets-responsive-styles' }, marketResponsiveStyles),
            ...SectionHeading({
                title: text('Märkte / Hauptkategorien', 'Markets / main categories'),
                hint: text(
                    'Die Marktreihenfolge ist die oberste Sortierebene. Aliase werden kommagetrennt angegeben.',
                    'Market order is the top sorting level. Aliases are entered comma-separated.',
                ),
                tokens,
            }),
        ];

        if (!markets.length) {
            children.push(
                h(
                    'div',
                    { key: 'empty', style: { color: tokens.muted, padding: '12px 0', marginBottom: '18px' } },
                    text('Noch keine Märkte vorhanden.', 'No markets configured yet.'),
                ),
            );
        } else {
            children.push(
                h(
                    BorderedList,
                    { key: 'markets', tokens },
                    markets.map((market, index) => this.renderMarketRow(market, index, markets, tokens)),
                ),
            );
        }

        children.push(
            ...SectionHeading({
                title: text('Markt hinzufügen', 'Add market'),
                tokens,
                titleKey: 'add-title',
                hintKey: 'add-hint',
            }),
        );
        children.push(
            h(AddControls, { key: 'add-controls' }, [
                h(TextInput, {
                    key: 'name',
                    ariaLabel: text('Neuer Markt', 'New market'),
                    onChange: event => this.setState({ newName: event.target.value }),
                    onKeyDown: event => {
                        if (event.key === 'Enter') {
                            this.add();
                        }
                    },
                    placeholder: text('Name des Marktes', 'Market name'),
                    tokens,
                    value: this.state.newName,
                }),
                h(
                    ActionButton,
                    {
                        key: 'add',
                        disabled: !this.state.newName.trim(),
                        onClick: () => this.add(),
                        tokens,
                    },
                    text('Hinzufügen', 'Add'),
                ),
            ]),
        );

        return h(EditorFrame, null, children);
    }
}

module.exports = {
    Components: { MarketsEditor },
    MarketsEditorModel: {
        addMarket,
        editMarket,
        marketRows,
        moveMarket,
        nextMarketOrder,
        removeMarket,
    },
};
