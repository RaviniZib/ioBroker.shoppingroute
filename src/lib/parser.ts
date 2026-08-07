import type { MarketConfig, ParsedItem, ProductConfig } from './model';

const CATEGORY_RULES: Array<{ category: string; terms: string[] }> = [
    { category: 'TK-Produkte', terms: ['tiefkühl', 'tiefkuehl', 'gefroren', 'gefrohren', 'fischstäb', 'fischstaeb', 'pommes', 'eis'] },
    { category: 'Konserven', terms: ['dose', 'dosen', 'konserve', 'cornedbeef', 'corned beef', 'gewürzgurke', 'gewuerzgurke', 'pesto', 'mais', 'aioli'] },
    { category: 'H-Milch/Nudeln', terms: ['h-milch', 'h. milch', 'nudel', 'spaghetti', 'penne', 'reis', 'haferflock', 'speisestärke', 'speisestaerke', 'öl', 'oel'] },
    { category: 'Kosmetikartikel', terms: ['toilettenpapier', 'duschgel', 'shampoo', 'zahnpasta', 'zahnbürste', 'zahnbuerste', 'deo', 'seife', 'creme', 'rasierer', 'kosmetik'] },
    { category: 'Nonfood', terms: ['pinsel', 'verbandtasche', 'fussmatte', 'fußmatte', 'katzenfutter', 'katzenstreu', 'müllbeutel', 'muellbeutel', 'reiniger', 'spülmittel', 'spuelmittel', 'waschmittel', 'batterie', 'lampe'] },
    { category: 'Getränke', terms: ['saft', 'cola', 'pepsi', 'wasser', 'limonade', 'sprite', 'fanta', 'bier', 'getränk', 'getraenk'] },
    { category: 'Tee/Kaffee', terms: ['tee', 'kaffee', 'espresso', 'cappuccino'] },
    { category: 'Brot/Gebäck', terms: ['brot', 'brötchen', 'broetchen', 'baguette', 'toast', 'kuchen', 'torte', 'croissant', 'apfeltasche'] },
    { category: 'Schokolade/Naschen', terms: ['schokolade', 'gummi', 'haribo', 'chips', 'keks', 'bonbon', 'mandel', 'nuss', 'nüsse', 'nuesse', 'sonnenblumenkern', 'kokosraspel'] },
    { category: 'Wurst/Salate/Teigwaren', terms: ['aufschnitt', 'schinken', 'salami', 'leberwurst', 'würst', 'wuerst', 'bacon', 'speck', 'frikadelle', 'fleischsalat', 'eiersalat', 'kartoffelsalat', 'geflügelsalat', 'gefluegelsalat', 'blätterteig', 'blaetterteig', 'pizzateig', 'döner', 'doener'] },
    { category: 'Milchprodukte', terms: ['milch', 'joghurt', 'quark', 'käse', 'kaese', 'camembert', 'camenbert', 'feta', 'ricotta', 'parmesan', 'gouda', 'sahne', 'butter', 'brunch', 'ei', 'eier'] },
    { category: 'Fleisch/Fisch', terms: ['fleisch', 'hack', 'steak', 'gulasch', 'roulade', 'hähnchen', 'haehnchen', 'kassler', 'lachs', 'fisch'] },
    { category: 'Obst/Gemüse', terms: ['apfel', 'äpfel', 'aepfel', 'banane', 'mango', 'melone', 'nektarine', 'beere', 'avocado', 'karotte', 'möhre', 'moehre', 'gurke', 'tomate', 'paprika', 'zucchini', 'salat', 'rosenkohl', 'kartoffel', 'zwiebel', 'knoblauch', 'zitrone', 'orange', 'obst', 'gemüse', 'gemuese'] },
];

const QUANTITY_WORDS = [
    'stück', 'stueck', 'packung', 'packungen', 'paket', 'pakete', 'flasche', 'flaschen',
    'dose', 'dosen', 'becher', 'glas', 'gläser', 'glaeser', 'kg', 'kilogramm', 'g', 'gramm',
    'l', 'liter', 'ml', 'milliliter', 'bund', 'netz', 'schachtel', 'schachteln', 'rolle', 'rollen',
];

export function normalize(text: string): string {
    return String(text || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('de-DE');
}

function splitAliases(value?: string): string[] {
    return String(value || '')
        .split(/[;,]/)
        .map(alias => normalize(alias))
        .filter(Boolean);
}

function marketAliases(markets: MarketConfig[]): Array<{ market: string; alias: string }> {
    const result: Array<{ market: string; alias: string }> = [];

    for (const market of markets) {
        if (market.enabled === false || !market.name) continue;
        result.push({ market: market.name, alias: normalize(market.name) });
        for (const alias of splitAliases(market.aliases)) {
            result.push({ market: market.name, alias });
        }
    }

    return result.sort((a, b) => b.alias.length - a.alias.length);
}

function extractMarket(text: string, markets: MarketConfig[]): { productText: string; market?: string; explicit: boolean } {
    const normalized = normalize(text);

    for (const entry of marketAliases(markets)) {
        const patterns = [
            ` von ${entry.alias}`,
            ` bei ${entry.alias}`,
        ];

        for (const pattern of patterns) {
            if (normalized.endsWith(pattern)) {
                return {
                    productText: text.slice(0, text.length - pattern.length).trim(),
                    market: entry.market,
                    explicit: true,
                };
            }
        }
    }

    return { productText: text.trim(), explicit: false };
}

function stripQuantity(text: string): string {
    let result = text.trim();

    // Keep fractions such as "1/2 Pfeiffer Leberwurst" intact. Exact product matching is attempted first.
    result = result.replace(/^\d+(?:[.,]\d+)?\s*[xX]\s+/, '');

    const units = QUANTITY_WORDS.join('|');
    const withUnit = new RegExp(`^\\d+(?:[.,]\\d+)?\\s+(?:${units})\\s+`, 'i');
    if (withUnit.test(result)) return result.replace(withUnit, '').trim();

    return result.replace(/^\d+(?:[.,]\d+)?\s+/, '').trim();
}

function productCandidates(text: string): string[] {
    const result = [normalize(text)];
    const stripped = normalize(stripQuantity(text));
    if (stripped && !result.includes(stripped)) result.push(stripped);
    return result;
}

function findProduct(text: string, products: ProductConfig[]): ProductConfig | undefined {
    const candidates = productCandidates(text);

    for (const product of products) {
        const aliases = [normalize(product.name), ...splitAliases(product.aliases)].filter(Boolean);
        if (candidates.some(candidate => aliases.includes(candidate))) return product;
    }

    return undefined;
}

export function guessCategory(text: string): string {
    const value = normalize(stripQuantity(text));
    for (const rule of CATEGORY_RULES) {
        if (rule.terms.some(term => value.includes(term))) return rule.category;
    }
    return 'Sonstiges';
}

export function parseItem(
    originalText: string,
    markets: MarketConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
): ParsedItem {
    const marketResult = extractMarket(originalText, markets);
    const product = findProduct(marketResult.productText, products);
    const productText = stripQuantity(marketResult.productText);

    return {
        originalText,
        productText,
        productName: product?.name || productText || marketResult.productText,
        market: marketResult.market || product?.defaultMarket || fallbackMarket,
        category: product?.category || guessCategory(marketResult.productText),
        knownProduct: Boolean(product),
        explicitMarket: marketResult.explicit,
    };
}
