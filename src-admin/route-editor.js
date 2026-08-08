'use strict';

const React = require('react');

const h = React.createElement;
const text = (de, en) => {
    const language = typeof navigator !== 'undefined' ? String(navigator.language || '').toLowerCase() : 'de';
    return language.startsWith('de') ? de : en;
};
const ciCompare = (a, b) => String(a || '').localeCompare(String(b || ''), 'de', { sensitivity: 'base' });
const sameMarket = (a, b) => String(a || '').localeCompare(String(b || ''), 'de', { sensitivity: 'base' }) === 0;

class RouteEditor extends React.Component {
    constructor(props) {
        super(props);
        this.state = { selectedMarket: this.firstMarket(props.data) };
    }

    activeMarkets(data) {
        return (Array.isArray(data && data.markets) ? data.markets : [])
            .filter(market => market && market.name && market.enabled !== false)
            .map(market => String(market.name).trim())
            .filter(Boolean)
            .sort(ciCompare);
    }

    firstMarket(data) {
        return this.activeMarkets(data)[0] || '';
    }

    componentDidUpdate(prevProps) {
        if (prevProps.data === this.props.data) return;
        const markets = this.activeMarkets(this.props.data);
        if (!markets.some(market => sameMarket(market, this.state.selectedMarket))) {
            const selectedMarket = markets[0] || '';
            if (selectedMarket !== this.state.selectedMarket) this.setState({ selectedMarket });
        }
    }

    selectedRoutes() {
        const routes = Array.isArray(this.props.data && this.props.data.routes) ? this.props.data.routes : [];
        return routes
            .map((route, originalIndex) => ({ route, originalIndex }))
            .filter(entry => entry.route && sameMarket(entry.route.market, this.state.selectedMarket))
            .sort((a, b) => {
                const ao = Number(a.route.order) || 999999;
                const bo = Number(b.route.order) || 999999;
                return ao - bo || a.originalIndex - b.originalIndex;
            });
    }

    move(fromIndex, direction) {
        const selected = this.selectedRoutes().map(entry => ({ ...entry.route }));
        const toIndex = fromIndex + direction;
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= selected.length || toIndex >= selected.length) return;
        [selected[fromIndex], selected[toIndex]] = [selected[toIndex], selected[fromIndex]];
        selected.forEach((route, index) => { route.order = (index + 1) * 10; });

        const allRoutes = Array.isArray(this.props.data && this.props.data.routes) ? this.props.data.routes : [];
        const rebuilt = [];
        let inserted = false;
        for (const route of allRoutes) {
            if (route && sameMarket(route.market, this.state.selectedMarket)) {
                if (!inserted) {
                    rebuilt.push(...selected);
                    inserted = true;
                }
                continue;
            }
            rebuilt.push(route);
        }
        if (!inserted) rebuilt.push(...selected);
        this.props.onChange({ ...(this.props.data || {}), routes: rebuilt }, true);
    }

    render() {
        const data = this.props.data || {};
        const markets = this.activeMarkets(data);
        const selectedMarket = this.state.selectedMarket;
        const routes = this.selectedRoutes();
        const dark = String(this.props.themeType || '').toLowerCase() === 'dark';
        const border = dark ? '#555' : '#d5d5d5';
        const background = dark ? '#2b2b2b' : '#fff';
        const muted = dark ? '#bbb' : '#666';
        const buttonBackground = dark ? '#3b3b3b' : '#f4f4f4';

        const children = [
            h('div', { key: 'selector', style: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '16px' } }, [
                h('label', { key: 'label', htmlFor: 'shoppingroute-route-market', style: { fontWeight: 600 } }, text('Markt auswählen:', 'Select market:')),
                h('select', {
                    key: 'select', id: 'shoppingroute-route-market', value: selectedMarket,
                    onChange: event => this.setState({ selectedMarket: event.target.value }),
                    style: { minWidth: '240px', padding: '9px 12px', borderRadius: '4px', border: `1px solid ${border}`, background, color: 'inherit' },
                }, markets.map(market => h('option', { key: market, value: market }, market))),
            ]),
        ];

        if (!markets.length) {
            children.push(h('div', { key: 'no-markets', style: { color: muted, padding: '12px 0' } }, text('Noch keine aktiven Märkte vorhanden.', 'No active markets configured yet.')));
            return h('div', { style: { width: '100%' } }, children);
        }

        if (!routes.length) {
            children.push(h('div', { key: 'no-routes', style: { color: muted, padding: '12px 0' } }, text('Für diesen Markt ist noch kein Laufweg vorhanden. Nach dem Speichern/Neustart ergänzt ShoppingRoute fehlende Produktgruppen automatisch.', 'No walking route exists for this market yet. After saving/restarting, ShoppingRoute automatically adds missing product groups.')));
            return h('div', { style: { width: '100%' } }, children);
        }

        children.push(h('div', { key: 'hint', style: { color: muted, marginBottom: '8px', fontSize: '0.92rem' } }, text('Oben beginnt der Laufweg. Mit ↑ und ↓ verschiebst du die Produktgruppen nur innerhalb dieses Marktes.', 'The walking route starts at the top. Use ↑ and ↓ to move product groups only within this market.')));
        children.push(h('div', { key: 'routes', style: { border: `1px solid ${border}`, borderRadius: '6px', overflow: 'hidden' } }, routes.map((entry, index) =>
            h('div', {
                key: `${entry.route.market}-${entry.route.category}-${entry.originalIndex}`,
                style: { display: 'grid', gridTemplateColumns: '48px minmax(160px, 1fr) 96px', alignItems: 'center', gap: '8px', padding: '9px 12px', borderBottom: index < routes.length - 1 ? `1px solid ${border}` : 'none', background },
            }, [
                h('div', { key: 'position', style: { color: muted, textAlign: 'right', paddingRight: '6px' } }, String(index + 1)),
                h('div', { key: 'category', style: { fontWeight: 500 } }, String(entry.route.category || '')),
                h('div', { key: 'buttons', style: { display: 'flex', justifyContent: 'flex-end', gap: '6px' } }, [
                    h('button', {
                        key: 'up', type: 'button', disabled: index === 0, title: text('Nach oben', 'Move up'),
                        onClick: () => this.move(index, -1),
                        style: { width: '38px', height: '32px', border: `1px solid ${border}`, borderRadius: '4px', background: buttonBackground, color: 'inherit', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.4 : 1 },
                    }, '↑'),
                    h('button', {
                        key: 'down', type: 'button', disabled: index === routes.length - 1, title: text('Nach unten', 'Move down'),
                        onClick: () => this.move(index, 1),
                        style: { width: '38px', height: '32px', border: `1px solid ${border}`, borderRadius: '4px', background: buttonBackground, color: 'inherit', cursor: index === routes.length - 1 ? 'default' : 'pointer', opacity: index === routes.length - 1 ? 0.4 : 1 },
                    }, '↓'),
                ]),
            ])
        )));
        return h('div', { style: { width: '100%' } }, children);
    }
}

module.exports = {
    Components: {
        RouteEditor,
    },
};
