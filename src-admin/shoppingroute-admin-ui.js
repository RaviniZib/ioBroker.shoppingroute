'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');

const h = React.createElement;

const responsiveStyles = `
    .shoppingroute-editor-row {
        display: grid;
        grid-template-columns: 48px minmax(160px, 1fr) 144px;
        align-items: center;
        gap: 8px;
        padding: 9px 12px;
    }
    .shoppingroute-editor-row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 6px;
    }
    .shoppingroute-editor-add-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
    }
    .shoppingroute-editor-control {
        box-sizing: border-box;
        min-width: 240px;
        max-width: 100%;
    }
    .shoppingroute-editor-button:hover:not(:disabled) {
        filter: brightness(0.96);
    }
    @media (max-width: 600px) {
        .shoppingroute-editor-row {
            grid-template-columns: 32px minmax(0, 1fr);
        }
        .shoppingroute-editor-row-actions {
            grid-column: 2;
            justify-content: flex-start;
        }
        .shoppingroute-editor-add-controls {
            align-items: stretch;
        }
        .shoppingroute-editor-control {
            min-width: 0;
            width: 100%;
        }
    }
`;

function text(de, en) {
    const language = typeof navigator !== 'undefined' ? String(navigator.language || '').toLowerCase() : 'de';
    return language.startsWith('de') ? de : en;
}

function themeTokens(themeType) {
    const dark = String(themeType || '').toLowerCase() === 'dark';
    return {
        border: dark ? '#555' : '#d5d5d5',
        background: dark ? '#2b2b2b' : '#fff',
        muted: dark ? '#bbb' : '#666',
        buttonBackground: dark ? '#3b3b3b' : '#f4f4f4',
    };
}

function EditorFrame({ children }) {
    return h(React.Fragment, null, [
        h('style', { key: 'responsive-styles' }, responsiveStyles),
        h('div', { key: 'content', style: { width: '100%' } }, children),
    ]);
}

function SectionHeading({ title, hint, tokens, titleKey = 'title', hintKey = 'hint' }) {
    return [
        h('h3', { key: titleKey, style: { margin: '0 0 6px' } }, title),
        hint
            ? h(
                  'div',
                  {
                      key: hintKey,
                      style: { color: tokens.muted, marginBottom: '10px', fontSize: '0.92rem' },
                  },
                  hint,
              )
            : null,
    ];
}

function BorderedList({ children, tokens, marginBottom = '18px' }) {
    return h(
        'div',
        {
            style: {
                border: `1px solid ${tokens.border}`,
                borderRadius: '6px',
                overflow: 'hidden',
                marginBottom,
            },
        },
        children,
    );
}

function EditorRow({ position, children, actions, last, tokens }) {
    return h(
        'div',
        {
            className: 'shoppingroute-editor-row',
            style: {
                borderBottom: last ? 'none' : `1px solid ${tokens.border}`,
                background: tokens.background,
            },
        },
        [
            h(
                'div',
                { key: 'position', style: { color: tokens.muted, textAlign: 'right', paddingRight: '6px' } },
                String(position),
            ),
            h('div', { key: 'content', style: { minWidth: 0 } }, children),
            h('div', { key: 'actions', className: 'shoppingroute-editor-row-actions' }, actions),
        ],
    );
}

function IconButton({ children, disabled = false, onClick, title, tokens }) {
    return h(
        'button',
        {
            className: 'shoppingroute-editor-button',
            type: 'button',
            disabled,
            title,
            'aria-label': title,
            onClick,
            style: {
                width: '38px',
                height: '32px',
                border: `1px solid ${tokens.border}`,
                borderRadius: '4px',
                background: tokens.buttonBackground,
                color: 'inherit',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.4 : 1,
            },
        },
        children,
    );
}

function TextInput({ ariaLabel, onChange, onKeyDown, placeholder, tokens, value }) {
    return h('input', {
        className: 'shoppingroute-editor-control',
        type: 'text',
        value,
        placeholder,
        'aria-label': ariaLabel,
        onChange,
        onKeyDown,
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

function ActionButton({ children, disabled = false, onClick, tokens }) {
    return h(
        'button',
        {
            className: 'shoppingroute-editor-button',
            type: 'button',
            disabled,
            onClick,
            style: {
                minHeight: '38px',
                padding: '7px 16px',
                border: `1px solid ${tokens.border}`,
                borderRadius: '4px',
                background: tokens.buttonBackground,
                color: 'inherit',
                cursor: disabled ? 'default' : 'pointer',
                fontWeight: 600,
                opacity: disabled ? 0.4 : 1,
            },
        },
        children,
    );
}

function AddControls({ children }) {
    return h('div', { className: 'shoppingroute-editor-add-controls' }, children);
}

module.exports = {
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
};
