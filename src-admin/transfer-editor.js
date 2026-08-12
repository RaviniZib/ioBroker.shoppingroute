'use strict';

/* eslint-disable jsdoc/require-jsdoc */
/* global window */

const React = require('react');
const { ActionButton, EditorFrame, SectionHeading, text, themeTokens } = require('./shoppingroute-admin-ui');
const { namespaceFromProps } = require('./shoppingroute-admin-connection');

const h = React.createElement;

class TransferEditor extends React.Component {
    openBackupUi() {
        const namespace = namespaceFromProps(this.props);
        const url = `./adapter/shoppingroute/backup-transfer.html?instance=${encodeURIComponent(namespace)}`;
        window.open(url, 'shoppingrouteBackup');
    }

    render() {
        const tokens = themeTokens(this.props.themeType);
        return h(EditorFrame, null, [
            ...SectionHeading({
                title: text('Sicherung / Teilen', 'Backup / sharing'),
                hint: text(
                    'Sicherungen und Marktprofile werden direkt als JSON-Datei heruntergeladen oder aus einer Datei wiederhergestellt.',
                    'Backups and market profiles are downloaded directly as JSON files or restored from a file.',
                ),
                tokens,
            }),
            h(
                'div',
                {
                    key: 'transfer-box',
                    style: {
                        border: `1px solid ${tokens.border}`,
                        borderRadius: '6px',
                        padding: '16px',
                        background: tokens.background,
                    },
                },
                [
                    h(
                        'div',
                        {
                            key: 'text',
                            style: { color: tokens.muted, marginBottom: '14px', lineHeight: 1.45 },
                        },
                        text(
                            'Die bestehende Sicherungs- und Freigabeoberfläche wird in einem separaten Dialog geöffnet und verwendet weiterhin die bewährte Import-/Export-Logik.',
                            'The existing backup and sharing interface opens in a separate dialog and keeps the proven import/export logic.',
                        ),
                    ),
                    h(
                        ActionButton,
                        {
                            key: 'open',
                            onClick: () => this.openBackupUi(),
                            tokens,
                        },
                        text('Sicherung / Teilen öffnen', 'Open backup / sharing'),
                    ),
                ],
            ),
        ]);
    }
}

module.exports = {
    Components: { TransferEditor },
};
