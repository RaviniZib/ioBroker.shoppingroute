'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');
const {
    ActionButton,
    AddControls,
    BorderedList,
    EditorFrame,
    EditorRow,
    Field,
    FormGrid,
    IconButton,
    SectionHeading,
    SelectInput,
    TextInput,
    text,
    themeTokens,
} = require('./shoppingroute-admin-ui');
const { joinCommaList, marketOptions, productGroupOptions } = require('./shoppingroute-admin-data');
const { sendTo } = require('./shoppingroute-admin-connection');

const h = React.createElement;

const actionOptions = [
    { value: 'pending', label: text('Offen', 'Pending') },
    { value: 'accept', label: text('Übernehmen', 'Accept') },
    { value: 'ignore', label: text('Ignorieren', 'Ignore') },
];

function reviewRows(reviewItems) {
    return (Array.isArray(reviewItems) ? reviewItems : []).map(item =>
        item && typeof item === 'object'
            ? { ...item }
            : {
                  product: '',
                  text: '',
                  category: '',
                  defaultMarket: '',
                  availableMarkets: '',
                  aliases: '',
                  action: 'pending',
              },
    );
}

function editReviewItem(reviewItems, index, patch) {
    const result = reviewRows(reviewItems);
    if (index >= 0 && index < result.length) {
        result[index] = { ...result[index], ...patch };
    }
    return result;
}

function removeReviewItem(reviewItems, index) {
    const result = reviewRows(reviewItems);
    if (index >= 0 && index < result.length) {
        result.splice(index, 1);
    }
    return result;
}

function moveReviewItem(reviewItems, fromIndex, direction) {
    const result = reviewRows(reviewItems);
    const toIndex = fromIndex + direction;
    if (fromIndex >= 0 && fromIndex < result.length && toIndex >= 0 && toIndex < result.length) {
        [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
    }
    return result;
}

class ReviewEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = { acceptAllBusy: false };
    }

    updateReviewItems(reviewItems) {
        this.props.onChange({ ...(this.props.data || {}), reviewItems }, true);
    }

    edit(index, patch) {
        this.updateReviewItems(editReviewItem(this.props.data && this.props.data.reviewItems, index, patch));
    }

    remove(index) {
        this.updateReviewItems(removeReviewItem(this.props.data && this.props.data.reviewItems, index));
    }

    move(index, direction) {
        this.updateReviewItems(moveReviewItem(this.props.data && this.props.data.reviewItems, index, direction));
    }

    async acceptAll() {
        this.setState({ acceptAllBusy: true });
        try {
            const response = await sendTo(this.props, 'markAllReviewItemsAccept', {
                native: this.props.data,
            });
            if (response && response.command && response.command.data) {
                this.props.onChange(response.command.data, true);
            }
        } finally {
            this.setState({ acceptAllBusy: false });
        }
    }

    render() {
        const reviewItems = reviewRows(this.props.data && this.props.data.reviewItems);
        const tokens = themeTokens(this.props.themeType);
        const groups = [{ value: '', label: '—' }].concat(
            productGroupOptions(this.props.data && this.props.data.productGroups),
        );
        const markets = marketOptions(this.props.data && this.props.data.markets, { includeEmpty: true });

        const children = [
            ...SectionHeading({
                title: text('Prüfliste', 'Review queue'),
                hint: text(
                    'Unbekannte Artikel prüfen, korrigieren und anschließend übernehmen oder ignorieren. Verfügbare Märkte werden kommagetrennt gespeichert.',
                    'Review unknown products, correct them and then accept or ignore them. Available markets are stored comma-separated.',
                ),
                tokens,
            }),
            h(AddControls, { key: 'review-actions' }, [
                h(
                    ActionButton,
                    {
                        key: 'accept-all',
                        disabled: this.state.acceptAllBusy || !reviewItems.length,
                        onClick: () => this.acceptAll(),
                        tokens,
                    },
                    this.state.acceptAllBusy
                        ? text('Setzt …', 'Setting …')
                        : text('Alle auf Übernehmen', 'Set all to accept'),
                ),
            ]),
        ];

        if (reviewItems.length) {
            children.push(
                h(
                    BorderedList,
                    { key: 'review-items', tokens },
                    reviewItems.map((item, index) =>
                        h(
                            EditorRow,
                            {
                                key: index,
                                position: index + 1,
                                last: index === reviewItems.length - 1,
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
                                            disabled: index === reviewItems.length - 1,
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
                                            title: text('Eintrag löschen', 'Delete item'),
                                            tokens,
                                        },
                                        '×',
                                    ),
                                ],
                            },
                            h(FormGrid, null, [
                                h(
                                    Field,
                                    { key: 'product', label: text('Artikel', 'Product'), span: 2, tokens },
                                    h(TextInput, {
                                        ariaLabel: text('Artikel bearbeiten', 'Edit product'),
                                        onChange: event => this.edit(index, { product: event.target.value }),
                                        tokens,
                                        value: String(item.product || ''),
                                    }),
                                ),
                                h(
                                    Field,
                                    { key: 'text', label: text('Alexa-Text', 'Alexa text'), span: 2, tokens },
                                    h(TextInput, {
                                        ariaLabel: text('Alexa-Text bearbeiten', 'Edit Alexa text'),
                                        onChange: event => this.edit(index, { text: event.target.value }),
                                        tokens,
                                        value: String(item.text || ''),
                                    }),
                                ),
                                h(
                                    Field,
                                    { key: 'category', label: text('Produktgruppe', 'Product group'), span: 2, tokens },
                                    h(SelectInput, {
                                        ariaLabel: text('Produktgruppe auswählen', 'Select product group'),
                                        onChange: event => this.edit(index, { category: event.target.value }),
                                        options: groups,
                                        tokens,
                                        value: String(item.category || ''),
                                    }),
                                ),
                                h(
                                    Field,
                                    {
                                        key: 'defaultMarket',
                                        label: text('Standardmarkt', 'Default market'),
                                        span: 2,
                                        tokens,
                                    },
                                    h(SelectInput, {
                                        ariaLabel: text('Standardmarkt auswählen', 'Select default market'),
                                        onChange: event => this.edit(index, { defaultMarket: event.target.value }),
                                        options: markets,
                                        tokens,
                                        value: String(item.defaultMarket || ''),
                                    }),
                                ),
                                h(
                                    Field,
                                    {
                                        key: 'availableMarkets',
                                        label: text('Verfügbare Märkte', 'Available markets'),
                                        span: 2,
                                        tokens,
                                    },
                                    h(TextInput, {
                                        ariaLabel: text('Verfügbare Märkte bearbeiten', 'Edit available markets'),
                                        onChange: event =>
                                            this.edit(index, { availableMarkets: joinCommaList(event.target.value) }),
                                        tokens,
                                        value: String(item.availableMarkets || ''),
                                    }),
                                ),
                                h(
                                    Field,
                                    { key: 'aliases', label: text('Aliase', 'Aliases'), span: 1, tokens },
                                    h(TextInput, {
                                        ariaLabel: text('Aliase bearbeiten', 'Edit aliases'),
                                        onChange: event => this.edit(index, { aliases: event.target.value }),
                                        tokens,
                                        value: String(item.aliases || ''),
                                    }),
                                ),
                                h(
                                    Field,
                                    { key: 'action', label: text('Aktion', 'Action'), span: 1, tokens },
                                    h(SelectInput, {
                                        ariaLabel: text('Aktion auswählen', 'Select action'),
                                        onChange: event => this.edit(index, { action: event.target.value }),
                                        options: actionOptions,
                                        tokens,
                                        value: String(item.action || 'pending'),
                                    }),
                                ),
                            ]),
                        ),
                    ),
                ),
            );
        }

        return h(EditorFrame, null, children);
    }
}

module.exports = {
    Components: { ReviewEditor },
    ReviewEditorModel: {
        editReviewItem,
        moveReviewItem,
        removeReviewItem,
        reviewRows,
    },
};
