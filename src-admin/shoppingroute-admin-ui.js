'use strict';

/* eslint-disable jsdoc/require-jsdoc */

const React = require('react');

const h = React.createElement;

const responsiveStyles = `
    .shoppingroute-editor-row {
        display: grid;
        grid-template-columns: 64px minmax(160px, 1fr) 144px;
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
            grid-template-columns: 56px minmax(0, 1fr);
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

function BorderedList({ children, tokens, marginBottom = '18px', scope }) {
    return h(
        'div',
        {
            'data-sort-scope': scope,
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

function dropIndex(event, index, from, length) {
    const rect = event.currentTarget?.getBoundingClientRect?.();
    let slot = index;
    if (rect && event.clientY >= rect.top + rect.height / 2) {
        slot++;
    }
    if (from >= 0 && from < slot) {
        slot--;
    }
    return Math.max(0, Math.min(length - 1, slot));
}

function DropZone({ onDrop, tokens, length, scope }) {
    return h(
        'div',
        {
            className: 'shoppingroute-drop-end',
            'data-sort-scope': scope,
            'data-drop-index': length,
            'data-drop-end': true,
            onDragOver: event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
            },
            onDrop: event => {
                event.preventDefault();
                event.stopPropagation();
                onDrop();
            },
            style: {
                minHeight: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px 12px',
                borderTop: `1px dashed ${tokens?.border || '#888'}`,
                opacity: 0.75,
            },
        },
        text('Hier ans Ende ziehen', 'Drop here at the end'),
    );
}

class DragHandle extends React.Component {
    render() {
        return h(
            'span',
            {
                role: 'button',
                tabIndex: 0,
                'aria-label': text(
                    'Ziehen zum Verschieben; Pfeile als Alternative',
                    'Drag to move; arrows are also available',
                ),
                style: {
                    display: 'inline-flex',
                    minWidth: '44px',
                    minHeight: '44px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    touchAction: 'none',
                    cursor: 'grab',
                    userSelect: 'none',
                },
                onPointerDown: event => {
                    if (event.pointerType === 'mouse' || this.props.disabled) {
                        return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    this.target = null;
                    this.pointer = event.pointerId;
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    this.props.onStart();
                },
                onPointerMove: event => {
                    if (this.pointer !== event.pointerId) {
                        return;
                    }
                    const element = event.currentTarget.ownerDocument.elementFromPoint(event.clientX, event.clientY);
                    const row = element?.closest?.('[data-drop-index]');
                    if (
                        !row ||
                        row.closest('[data-sort-scope]')?.getAttribute('data-sort-scope') !== this.props.scope
                    ) {
                        this.target = null;
                        return;
                    }
                    const index = Number(row.getAttribute('data-drop-index'));
                    const market = row.closest('[data-drop-market]')?.getAttribute('data-drop-market');
                    const length = Number(
                        row.closest('[data-drop-length]')?.getAttribute('data-drop-length') ?? this.props.length,
                    );
                    const crossMarket = market && this.props.market && market !== this.props.market;
                    this.target = {
                        market,
                        index: row.getAttribute('data-drop-end')
                            ? Math.max(0, length - (crossMarket ? 0 : 1))
                            : dropIndex(
                                  { currentTarget: row, clientY: event.clientY },
                                  index,
                                  crossMarket ? -1 : this.props.index,
                                  length + (crossMarket ? 1 : 0),
                              ),
                    };
                },
                onPointerUp: event => {
                    if (this.pointer !== event.pointerId) {
                        return;
                    }
                    this.pointer = null;
                    if (this.target !== null) {
                        this.props.onDrop(this.target.index, this.target.market);
                    }
                    this.props.onEnd?.();
                    this.target = null;
                },
                onPointerCancel: () => {
                    this.pointer = null;
                    this.target = null;
                    this.props.onEnd?.();
                },
            },
            '⋮⋮',
        );
    }
}

function EditorRow({
    position,
    children,
    actions,
    last,
    tokens,
    draggable = false,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    scope,
    length,
    onSortDrop,
    onSortStart,
}) {
    return h(
        'div',
        {
            className: 'shoppingroute-editor-row',
            draggable,
            onDragStart,
            onDragOver,
            onDrop,
            onDragEnd,
            'data-drop-index': position - 1,
            style: {
                borderBottom: last ? 'none' : `1px solid ${tokens.border}`,
                background: tokens.background,
            },
        },
        [
            h(
                'div',
                {
                    key: 'position',
                    style: { color: tokens.muted, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' },
                },
                [
                    draggable
                        ? h(DragHandle, {
                              key: 'drag',
                              scope,
                              length,
                              index: position - 1,
                              onStart: onSortStart,
                              onDrop: onSortDrop,
                              onEnd: onDragEnd,
                          })
                        : null,
                    String(position),
                ],
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
    DragHandle,
    DropZone,
    dropIndex,
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
