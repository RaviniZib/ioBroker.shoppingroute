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

function productGroupRows(productGroups) {
    return (Array.isArray(productGroups) ? productGroups : []).map(group => {
        if (group && typeof group === 'object' && !Array.isArray(group)) {
            return { ...group };
        }
        return { name: String(group || '') };
    });
}

function addProductGroup(productGroups, name) {
    const value = String(name || '').trim();
    const result = productGroupRows(productGroups);
    if (value) {
        result.push({ name: value });
    }
    return result;
}

function editProductGroup(productGroups, index, name) {
    const result = productGroupRows(productGroups);
    if (index >= 0 && index < result.length) {
        result[index] = { ...result[index], name: String(name == null ? '' : name) };
    }
    return result;
}

function removeProductGroup(productGroups, index) {
    const result = productGroupRows(productGroups);
    if (index >= 0 && index < result.length) {
        result.splice(index, 1);
    }
    return result;
}

function moveProductGroup(productGroups, fromIndex, direction) {
    const result = productGroupRows(productGroups);
    const toIndex = fromIndex + direction;
    if (fromIndex >= 0 && fromIndex < result.length && toIndex >= 0 && toIndex < result.length) {
        [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
    }
    return result;
}

class ProductGroupsEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = { newName: '' };
    }

    updateProductGroups(productGroups) {
        this.props.onChange({ ...(this.props.data || {}), productGroups }, true);
    }

    add() {
        const next = addProductGroup(this.props.data && this.props.data.productGroups, this.state.newName);
        if (next.length === productGroupRows(this.props.data && this.props.data.productGroups).length) {
            return;
        }
        this.updateProductGroups(next);
        this.setState({ newName: '' });
    }

    edit(index, name) {
        this.updateProductGroups(editProductGroup(this.props.data && this.props.data.productGroups, index, name));
    }

    remove(index) {
        this.updateProductGroups(removeProductGroup(this.props.data && this.props.data.productGroups, index));
    }

    move(index, direction) {
        this.updateProductGroups(moveProductGroup(this.props.data && this.props.data.productGroups, index, direction));
    }

    render() {
        const groups = productGroupRows(this.props.data && this.props.data.productGroups);
        const tokens = themeTokens(this.props.themeType);
        const children = [
            ...SectionHeading({
                title: text('Produktgruppen', 'Product groups'),
                hint: text(
                    'Zentraler Katalog aller Produktgruppen. Änderungen werden erst mit dem Instanzdialog gespeichert.',
                    'Central catalogue of all product groups. Changes are saved only with the instance dialog.',
                ),
                tokens,
            }),
        ];

        if (!groups.length) {
            children.push(
                h(
                    'div',
                    { key: 'empty', style: { color: tokens.muted, padding: '12px 0', marginBottom: '18px' } },
                    text('Noch keine Produktgruppen vorhanden.', 'No product groups configured yet.'),
                ),
            );
        } else {
            children.push(
                h(
                    BorderedList,
                    { key: 'groups', tokens },
                    groups.map((group, index) =>
                        h(
                            EditorRow,
                            {
                                key: index,
                                position: index + 1,
                                last: index === groups.length - 1,
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
                                            disabled: index === groups.length - 1,
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
                                            title: text('Produktgruppe löschen', 'Delete product group'),
                                            tokens,
                                        },
                                        '×',
                                    ),
                                ],
                            },
                            h(TextInput, {
                                ariaLabel: text('Produktgruppe bearbeiten', 'Edit product group'),
                                onChange: event => this.edit(index, event.target.value),
                                tokens,
                                value: String(group.name || ''),
                            }),
                        ),
                    ),
                ),
            );
        }

        children.push(
            ...SectionHeading({
                title: text('Produktgruppe hinzufügen', 'Add product group'),
                tokens,
                titleKey: 'add-title',
                hintKey: 'add-hint',
            }),
        );
        children.push(
            h(AddControls, { key: 'add-controls' }, [
                h(TextInput, {
                    key: 'name',
                    ariaLabel: text('Neue Produktgruppe', 'New product group'),
                    onChange: event => this.setState({ newName: event.target.value }),
                    onKeyDown: event => {
                        if (event.key === 'Enter') {
                            this.add();
                        }
                    },
                    placeholder: text('Name der Produktgruppe', 'Product group name'),
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
    Components: { ProductGroupsEditor },
    ProductGroupsEditorModel: {
        addProductGroup,
        editProductGroup,
        moveProductGroup,
        productGroupRows,
        removeProductGroup,
    },
};
