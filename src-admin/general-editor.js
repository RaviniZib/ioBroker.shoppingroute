'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');
const {
    CheckboxInput,
    EditorFrame,
    Field,
    FormGrid,
    NumberInput,
    SectionHeading,
    SelectInput,
    text,
    themeTokens,
} = require('./shoppingroute-admin-ui');
const { getAdapterInstances, getState, namespaceFromProps, setState } = require('./shoppingroute-admin-connection');
const { marketOptions } = require('./shoppingroute-admin-data');

const h = React.createElement;

const learningModeOptions = [
    { value: 'review', label: text('Erst prüfen', 'Review first') },
    { value: 'automatic', label: text('Automatisch lernen', 'Learn automatically') },
    { value: 'off', label: text('Nicht lernen', 'Do not learn') },
];

class GeneralEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            alexaInstances: [],
            temporaryMarket: '__none__',
            temporaryLoading: true,
            temporarySaving: false,
        };
    }

    componentDidMount() {
        void this.loadAlexaInstances();
        void this.loadTemporaryMarket();
    }

    async loadAlexaInstances() {
        try {
            const instances = await getAdapterInstances('alexa2');
            const current = String((this.props.data && this.props.data.alexaInstance) || '');
            const options = [...new Set(instances.map(entry => entry.id).concat(current ? [current] : []))]
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }))
                .map(id => ({ value: id, label: id }));
            this.setState({ alexaInstances: options });
        } catch {
            const current = String((this.props.data && this.props.data.alexaInstance) || '');
            this.setState({
                alexaInstances: current ? [{ value: current, label: current }] : [],
            });
        }
    }

    async loadTemporaryMarket() {
        try {
            const state = await getState(`${namespaceFromProps(this.props)}.control.temporaryPriorityMarket`);
            this.setState({
                temporaryMarket: typeof state?.val === 'string' && state.val ? state.val : '__none__',
                temporaryLoading: false,
            });
        } catch {
            this.setState({ temporaryMarket: '__none__', temporaryLoading: false });
        }
    }

    updateField(field, value) {
        this.props.onChange({ ...(this.props.data || {}), [field]: value }, true);
    }

    async updateTemporaryMarket(value) {
        this.setState({ temporarySaving: true, temporaryMarket: value });
        try {
            await setState(`${namespaceFromProps(this.props)}.control.temporaryPriorityMarket`, value);
        } finally {
            this.setState({ temporarySaving: false });
        }
    }

    renderBooleanField(key, label, tokens, span = 6) {
        return h(
            Field,
            { key, span, tokens },
            h(CheckboxInput, {
                checked: this.props.data && this.props.data[key] === true,
                label,
                onChange: event => this.updateField(key, event.target.checked),
            }),
        );
    }

    renderNumberField(key, label, tokens, span = 6, min, max) {
        return h(
            Field,
            { key, label, span, tokens },
            h(NumberInput, {
                ariaLabel: label,
                min,
                max,
                onChange: event => this.updateField(key, Number(event.target.value)),
                tokens,
                value: this.props.data && this.props.data[key] != null ? String(this.props.data[key]) : '',
            }),
        );
    }

    render() {
        const tokens = themeTokens(this.props.themeType);
        const configuredMarkets = marketOptions(this.props.data && this.props.data.markets, { includeEmpty: true });
        const temporaryMarkets = [{ value: '__none__', label: text('— Kein Markt —', '— No market —') }].concat(
            marketOptions(this.props.data && this.props.data.markets, { onlyEnabled: true }),
        );
        const alexaInstances = [{ value: '', label: '—' }].concat(this.state.alexaInstances);

        const warning = h(
            'div',
            {
                key: 'warning',
                style: {
                    border: `1px solid ${tokens.border}`,
                    borderRadius: '6px',
                    padding: '12px 14px',
                    marginBottom: '18px',
                    background: tokens.buttonBackground,
                },
            },
            text(
                'Sicherheitshinweis: zuerst mit Dry-Run testen. Änderungen an dieser Seite werden erst mit dem Instanzdialog gespeichert.',
                'Safety notice: start with dry run enabled. Changes on this page are saved only with the instance dialog.',
            ),
        );

        return h(EditorFrame, null, [
            warning,
            ...SectionHeading({
                title: text('Grundeinstellungen', 'Basic settings'),
                tokens,
                titleKey: 'basic-title',
            }),
            h(FormGrid, { key: 'basic-grid' }, [
                h(
                    Field,
                    { key: 'alexaInstance', label: text('Alexa2-Instanz', 'Alexa2 instance'), span: 6, tokens },
                    h(SelectInput, {
                        ariaLabel: text('Alexa2-Instanz auswählen', 'Select Alexa2 instance'),
                        onChange: event => this.updateField('alexaInstance', event.target.value),
                        options: alexaInstances,
                        tokens,
                        value: String((this.props.data && this.props.data.alexaInstance) || ''),
                    }),
                ),
                this.renderBooleanField('dryRun', text('Dry-Run', 'Dry run'), tokens, 6),
                h(
                    Field,
                    {
                        key: 'learningMode',
                        label: text('Umgang mit unbekannten Artikeln', 'Unknown-product handling'),
                        span: 6,
                        tokens,
                    },
                    h(SelectInput, {
                        ariaLabel: text('Lernmodus auswählen', 'Select learning mode'),
                        onChange: event => this.updateField('learningMode', event.target.value),
                        options: learningModeOptions,
                        tokens,
                        value: String((this.props.data && this.props.data.learningMode) || 'review'),
                    }),
                ),
                this.renderBooleanField(
                    'autoAliasSuggestions',
                    text('Aliase automatisch vorschlagen', 'Suggest aliases automatically'),
                    tokens,
                    6,
                ),
            ]),
            ...SectionHeading({
                title: text('Marktzuordnung', 'Market assignment'),
                hint: text(
                    'Der Markt für den aktuellen Einkauf überschreibt vorübergehend Listen- und Standardmarkt.',
                    'The market for the current shopping trip temporarily overrides list and default markets.',
                ),
                tokens,
                titleKey: 'market-title',
                hintKey: 'market-hint',
            }),
            h(FormGrid, { key: 'market-grid' }, [
                this.renderBooleanField(
                    'marketHeaders',
                    text('Marktüberschriften in der Alexa-Liste', 'Market headings in Alexa list'),
                    tokens,
                    6,
                ),
                this.renderNumberField(
                    'minItemsPerMarket',
                    text('Mindestanzahl Artikel pro zusätzlichem Markt', 'Minimum items per additional market'),
                    tokens,
                    6,
                    1,
                    99,
                ),
                h(
                    Field,
                    { key: 'fallbackMarket', label: text('Fallback-Markt', 'Fallback market'), span: 6, tokens },
                    h(SelectInput, {
                        ariaLabel: text('Fallback-Markt auswählen', 'Select fallback market'),
                        onChange: event => this.updateField('fallbackMarket', event.target.value),
                        options: configuredMarkets,
                        tokens,
                        value: String((this.props.data && this.props.data.fallbackMarket) || ''),
                    }),
                ),
                h(
                    Field,
                    {
                        key: 'priorityMarket',
                        label: text('Standardmarkt für Einkäufe', 'Default market for shopping'),
                        span: 6,
                        tokens,
                    },
                    h(SelectInput, {
                        ariaLabel: text('Standardmarkt auswählen', 'Select default market'),
                        onChange: event => this.updateField('priorityMarket', event.target.value),
                        options: configuredMarkets,
                        tokens,
                        value: String((this.props.data && this.props.data.priorityMarket) || ''),
                    }),
                ),
                h(
                    Field,
                    {
                        key: 'temporaryMarketState',
                        label: text('Markt für aktuellen Einkauf', 'Market for current shopping'),
                        span: 6,
                        tokens,
                    },
                    h(SelectInput, {
                        ariaLabel: text('Markt für aktuellen Einkauf auswählen', 'Select market for current shopping'),
                        onChange: event => this.updateTemporaryMarket(event.target.value),
                        options: temporaryMarkets,
                        tokens,
                        value: this.state.temporaryMarket,
                    }),
                ),
                h(
                    Field,
                    { key: 'temporary-status', span: 6, tokens },
                    h(
                        'div',
                        { style: { color: tokens.muted, paddingTop: '12px' } },
                        this.state.temporarySaving
                            ? text('Aktualisiert …', 'Updating …')
                            : this.state.temporaryLoading
                              ? text('Lädt …', 'Loading …')
                              : text(
                                    'Änderung wirkt sofort auf den aktuellen Einkauf.',
                                    'Change applies immediately to the current shopping trip.',
                                ),
                    ),
                ),
            ]),
            ...SectionHeading({
                title: text('Verarbeitungszeiten', 'Processing timing'),
                tokens,
                titleKey: 'timing-title',
            }),
            h(FormGrid, { key: 'timing-grid' }, [
                this.renderNumberField(
                    'debounceMs',
                    text('Listenänderungen sammeln für (ms)', 'Collect list changes for (ms)'),
                    tokens,
                    6,
                    250,
                    60000,
                ),
                this.renderNumberField(
                    'writePauseMs',
                    text('Pause zwischen Alexa-value-Schreibzugriffen (ms)', 'Pause between Alexa value writes (ms)'),
                    tokens,
                    6,
                    250,
                    10000,
                ),
            ]),
            ...SectionHeading({
                title: text('API-Schutz', 'API protection'),
                hint: text(
                    'Begrenzt Schreibzugriffe, teilt große Sortierungen in Blöcke und wiederholt vorübergehende Fehler mit wachsender Pause.',
                    'Limits write frequency, splits large sorts into batches and retries temporary errors with exponential backoff.',
                ),
                tokens,
                titleKey: 'api-title',
                hintKey: 'api-hint',
            }),
            h(FormGrid, { key: 'api-grid' }, [
                this.renderBooleanField('apiSafeMode', text('API-Schonmodus', 'API safe mode'), tokens, 6),
                this.renderNumberField(
                    'maxWritesPerMinute',
                    text('Max. Schreibzugriffe pro Minute', 'Max writes per minute'),
                    tokens,
                    6,
                    1,
                    120,
                ),
                this.renderNumberField('batchSize', text('Blockgröße', 'Batch size'), tokens, 6, 1, 100),
                this.renderNumberField(
                    'batchPauseMs',
                    text('Pause zwischen Blöcken (ms)', 'Pause between batches (ms)'),
                    tokens,
                    6,
                    0,
                    60000,
                ),
                this.renderNumberField(
                    'maxWriteRetries',
                    text('Wiederholungen pro Fehler', 'Retries per error'),
                    tokens,
                    6,
                    0,
                    5,
                ),
                this.renderNumberField(
                    'retryBaseMs',
                    text('Basis-Pause für Wiederholungen (ms)', 'Base delay for retries (ms)'),
                    tokens,
                    6,
                    250,
                    30000,
                ),
            ]),
        ]);
    }
}

module.exports = {
    Components: { GeneralEditor },
};
