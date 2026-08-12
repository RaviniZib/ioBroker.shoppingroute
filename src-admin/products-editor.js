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

const h = React.createElement;

function productRows(products) {
    return (Array.isArray(products) ? products : []).map(product =>
        product && typeof product === 'object'
            ? { ...product }
            : { name: String(product || ''), aliases: '', category: '', defaultMarket: '', availableMarkets: '' },
    );
}

function addProduct(products) {
    const result = productRows(products);
    result.push({ name: '', aliases: '', category: '', defaultMarket: '', availableMarkets: '' });
    return result;
}

function editProduct(products, index, patch) {
    const result = productRows(products);
    if (index >= 0 && index < result.length) {
        result[index] = { ...result[index], ...patch };
    }
    return result;
}

function removeProduct(products, index) {
    const result = productRows(products);
    if (index >= 0 && index < result.length) {
        result.splice(index, 1);
    }
    return result;
}

function moveProduct(products, fromIndex, direction) {
    const result = productRows(products);
    const toIndex = fromIndex + direction;
    if (fromIndex >= 0 && fromIndex < result.length && toIndex >= 0 && toIndex < result.length) {
        [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
    }
    return result;
}

class ProductsEditor extends React.Component {
    updateProducts(products) {
        this.props.onChange({ ...(this.props.data || {}), products }, true);
    }

    add() {
        this.updateProducts(addProduct(this.props.data && this.props.data.products));
    }

    edit(index, patch) {
        this.updateProducts(editProduct(this.props.data && this.props.data.products, index, patch));
    }

    remove(index) {
        this.updateProducts(removeProduct(this.props.data && this.props.data.products, index));
    }

    move(index, direction) {
        this.updateProducts(moveProduct(this.props.data && this.props.data.products, index, direction));
    }

    render() {
        const products = productRows(this.props.data && this.props.data.products);
        const tokens = themeTokens(this.props.themeType);
        const groups = [{ value: '', label: '—' }].concat(
            productGroupOptions(this.props.data && this.props.data.productGroups),
        );
        const markets = marketOptions(this.props.data && this.props.data.markets, { includeEmpty: true });
        const activeMarkets = marketOptions(this.props.data && this.props.data.markets, { onlyEnabled: true }).map(
            option => option.value,
        );

        const children = [
            ...SectionHeading({
                title: text('Artikel', 'Products'),
                hint: text(
                    'Artikelkatalog mit Produktgruppe, Standardmarkt und verfügbaren Märkten. Verfügbare Märkte werden kommagetrennt gespeichert.',
                    'Product catalogue with product group, default market and available markets. Available markets are stored comma-separated.',
                ),
                tokens,
            }),
        ];

        if (products.length) {
            children.push(
                h(
                    BorderedList,
                    { key: 'products', tokens },
                    products.map((product, index) =>
                        h(
                            EditorRow,
                            {
                                key: index,
                                position: index + 1,
                                last: index === products.length - 1,
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
                                            disabled: index === products.length - 1,
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
                                            title: text('Artikel löschen', 'Delete product'),
                                            tokens,
                                        },
                                        '×',
                                    ),
                                ],
                            },
                            h(FormGrid, null, [
                                h(
                                    Field,
                                    { key: 'name', label: text('Artikel', 'Product'), span: 3, tokens },
                                    h(TextInput, {
                                        ariaLabel: text('Artikel bearbeiten', 'Edit product'),
                                        onChange: event => this.edit(index, { name: event.target.value }),
                                        tokens,
                                        value: String(product.name || ''),
                                    }),
                                ),
                                h(
                                    Field,
                                    { key: 'aliases', label: text('Aliase', 'Aliases'), span: 3, tokens },
                                    h(TextInput, {
                                        ariaLabel: text('Aliase bearbeiten', 'Edit aliases'),
                                        onChange: event => this.edit(index, { aliases: event.target.value }),
                                        tokens,
                                        value: String(product.aliases || ''),
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
                                        value: String(product.category || ''),
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
                                        value: String(product.defaultMarket || ''),
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
                                        placeholder: activeMarkets.join(', '),
                                        tokens,
                                        value: String(product.availableMarkets || ''),
                                    }),
                                ),
                            ]),
                        ),
                    ),
                ),
            );
        }

        children.push(
            ...SectionHeading({
                title: text('Artikel hinzufügen', 'Add product'),
                tokens,
                titleKey: 'add-title',
                hintKey: 'add-hint',
            }),
        );
        children.push(
            h(AddControls, { key: 'add-controls' }, [
                h(
                    ActionButton,
                    { key: 'add', onClick: () => this.add(), tokens },
                    text('Neuer Artikel', 'New product'),
                ),
            ]),
        );

        return h(EditorFrame, null, children);
    }
}

module.exports = {
    Components: { ProductsEditor },
    ProductsEditorModel: {
        addProduct,
        editProduct,
        moveProduct,
        productRows,
        removeProduct,
    },
};
