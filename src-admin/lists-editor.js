'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');
const {
    ActionButton,
    AddControls,
    BorderedList,
    CheckboxInput,
    EditorFrame,
    EditorRow,
    Field,
    FormGrid,
    IconButton,
    SectionHeading,
    SelectInput,
    text,
    themeTokens,
} = require('./shoppingroute-admin-ui');
const { marketOptions } = require('./shoppingroute-admin-data');
const { getAdapterInstances, sendTo } = require('./shoppingroute-admin-connection');

const h = React.createElement;

function listRows(lists) {
    return (Array.isArray(lists) ? lists : []).map(list =>
        list && typeof list === 'object'
            ? { ...list }
            : { enabled: true, name: String(list || ''), priorityMarket: '' },
    );
}

function addList(lists) {
    const result = listRows(lists);
    result.push({ enabled: true, name: '', priorityMarket: '' });
    return result;
}

function editList(lists, index, patch) {
    const result = listRows(lists);
    if (index >= 0 && index < result.length) {
        result[index] = { ...result[index], ...patch };
    }
    return result;
}

function removeList(lists, index) {
    const result = listRows(lists);
    if (index >= 0 && index < result.length) {
        result.splice(index, 1);
    }
    return result;
}

function moveList(lists, fromIndex, direction) {
    const result = listRows(lists);
    const toIndex = fromIndex + direction;
    if (fromIndex >= 0 && fromIndex < result.length && toIndex >= 0 && toIndex < result.length) {
        [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
    }
    return result;
}

class ListsEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            alexaInstances: [],
            availableLists: [],
            loadingLists: false,
        };
    }

    componentDidMount() {
        void this.loadAlexaInstances();
        void this.loadLists(this.props);
    }

    componentDidUpdate(previousProps) {
        if (
            (previousProps.data && previousProps.data.alexaInstance) !==
            (this.props.data && this.props.data.alexaInstance)
        ) {
            void this.loadLists(this.props);
        }
    }

    async loadAlexaInstances() {
        try {
            const instances = await getAdapterInstances('alexa2');
            this.setState({
                alexaInstances: instances.map(entry => ({ value: entry.id, label: entry.id })),
            });
        } catch {
            this.setState({ alexaInstances: [] });
        }
    }

    async loadLists(props) {
        this.setState({ loadingLists: true });
        try {
            const result = await sendTo(props, 'getAlexaLists', {
                alexaInstance: props.data && props.data.alexaInstance,
            });
            const configured = listRows(props.data && props.data.lists)
                .map(entry => entry.name)
                .filter(Boolean);
            const options = [
                ...new Set([
                    ...(Array.isArray(result) ? result.map(item => item.label || item.value) : []),
                    ...configured,
                ]),
            ]
                .filter(Boolean)
                .sort((a, b) => String(a).localeCompare(String(b), 'de', { sensitivity: 'base' }))
                .map(name => ({ value: name, label: name }));
            this.setState({ availableLists: options, loadingLists: false });
        } catch {
            const fallback = listRows(props.data && props.data.lists)
                .map(entry => entry.name)
                .filter(Boolean)
                .sort((a, b) => String(a).localeCompare(String(b), 'de', { sensitivity: 'base' }))
                .map(name => ({ value: name, label: name }));
            this.setState({ availableLists: fallback, loadingLists: false });
        }
    }

    updateLists(lists) {
        this.props.onChange({ ...(this.props.data || {}), lists }, true);
    }

    edit(index, patch) {
        this.updateLists(editList(this.props.data && this.props.data.lists, index, patch));
    }

    add() {
        this.updateLists(addList(this.props.data && this.props.data.lists));
    }

    remove(index) {
        this.updateLists(removeList(this.props.data && this.props.data.lists, index));
    }

    move(index, direction) {
        this.updateLists(moveList(this.props.data && this.props.data.lists, index, direction));
    }

    render() {
        const lists = listRows(this.props.data && this.props.data.lists);
        const tokens = themeTokens(this.props.themeType);
        const marketChoices = marketOptions(this.props.data && this.props.data.markets, { includeEmpty: true });
        const listChoices = [
            { value: '', label: this.state.loadingLists ? text('Listen werden geladen …', 'Loading lists …') : '—' },
        ].concat(this.state.availableLists);
        const instanceChoices = [{ value: '', label: '—' }].concat(this.state.alexaInstances);

        const children = [
            ...SectionHeading({
                title: text('Listen', 'Lists'),
                hint: text(
                    'Aktive Alexa-Listen mit optionalem bevorzugtem Markt. Änderungen werden erst mit dem Instanzdialog gespeichert.',
                    'Active Alexa lists with an optional preferred market. Changes are saved only with the instance dialog.',
                ),
                tokens,
            }),
            h(FormGrid, { key: 'instance-grid' }, [
                h(
                    Field,
                    { key: 'instance', label: text('Alexa2-Instanz', 'Alexa2 instance'), span: 6, tokens },
                    h(SelectInput, {
                        ariaLabel: text('Alexa2-Instanz auswählen', 'Select Alexa2 instance'),
                        onChange: event =>
                            this.props.onChange(
                                { ...(this.props.data || {}), alexaInstance: event.target.value },
                                true,
                            ),
                        options: instanceChoices,
                        tokens,
                        value: String((this.props.data && this.props.data.alexaInstance) || ''),
                    }),
                ),
                h(
                    Field,
                    { key: 'refresh', label: text('Listen aktualisieren', 'Refresh lists'), span: 6, tokens },
                    h(
                        ActionButton,
                        {
                            disabled: this.state.loadingLists,
                            onClick: () => this.loadLists(this.props),
                            tokens,
                        },
                        this.state.loadingLists ? text('Lädt …', 'Loading …') : text('Neu laden', 'Reload'),
                    ),
                ),
            ]),
        ];

        if (lists.length) {
            children.push(
                h(
                    BorderedList,
                    { key: 'lists', tokens },
                    lists.map((list, index) =>
                        h(
                            EditorRow,
                            {
                                key: index,
                                position: index + 1,
                                last: index === lists.length - 1,
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
                                            disabled: index === lists.length - 1,
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
                                            title: text('Liste löschen', 'Delete list'),
                                            tokens,
                                        },
                                        '×',
                                    ),
                                ],
                            },
                            h(FormGrid, null, [
                                h(
                                    Field,
                                    { key: 'enabled', span: 2, tokens },
                                    h(CheckboxInput, {
                                        checked: list.enabled !== false,
                                        label: text('Aktiv', 'Active'),
                                        onChange: event => this.edit(index, { enabled: event.target.checked }),
                                    }),
                                ),
                                h(
                                    Field,
                                    { key: 'name', label: text('Alexa-Liste', 'Alexa list'), span: 5, tokens },
                                    h(SelectInput, {
                                        ariaLabel: text('Alexa-Liste auswählen', 'Select Alexa list'),
                                        onChange: event => this.edit(index, { name: event.target.value }),
                                        options: listChoices,
                                        tokens,
                                        value: String(list.name || ''),
                                    }),
                                ),
                                h(
                                    Field,
                                    {
                                        key: 'market',
                                        label: text('Bevorzugter Markt', 'Preferred market'),
                                        span: 5,
                                        tokens,
                                    },
                                    h(SelectInput, {
                                        ariaLabel: text('Bevorzugten Markt auswählen', 'Select preferred market'),
                                        onChange: event => this.edit(index, { priorityMarket: event.target.value }),
                                        options: marketChoices,
                                        tokens,
                                        value: String(list.priorityMarket || ''),
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
                title: text('Liste hinzufügen', 'Add list'),
                tokens,
                titleKey: 'add-title',
                hintKey: 'add-hint',
            }),
        );
        children.push(
            h(AddControls, { key: 'add-controls' }, [
                h(
                    ActionButton,
                    {
                        key: 'add',
                        onClick: () => this.add(),
                        tokens,
                    },
                    text('Neue Liste', 'New list'),
                ),
            ]),
        );

        return h(EditorFrame, null, children);
    }
}

module.exports = {
    Components: { ListsEditor },
    ListsEditorModel: {
        addList,
        editList,
        listRows,
        moveList,
        removeList,
    },
};
