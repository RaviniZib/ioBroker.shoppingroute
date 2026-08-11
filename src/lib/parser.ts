import type { MarketConfig, ParsedItem, ProductConfig } from './model';

const CATEGORY_RULES: Array<{ category: string; terms: string[] }> = [
    { category: 'TK-Produkte', terms: ['tiefkühl', 'tiefkuehl', 'gefroren', 'gefrohren', 'fischstäb', 'fischstaeb', 'pommes', 'eis'] },
    { category: 'Konserven', terms: ['dose', 'dosen', 'konserve', 'cornedbeef', 'corned beef', 'gewürzgurke', 'gewuerzgurke', 'pesto', 'mais', 'aioli'] },
    { category: 'H-Milch/Nudeln', terms: ['h-milch', 'h. milch', 'nudel', 'spaghetti', 'penne', 'reis', 'haferflock', 'speisestärke', 'speisestaerke', 'öl', 'oel'] },
    { category: 'Haushalt/Hygiene', terms: ['toilettenpapier', 'küchenrolle', 'kuechenrolle', 'taschentuch', 'müllbeutel', 'muellbeutel', 'spülmittel', 'spuelmittel', 'waschmittel', 'reiniger', 'schwamm', 'putztuch'] },
    { category: 'Kosmetikartikel', terms: ['duschgel', 'shampoo', 'zahnpasta', 'zahnbürste', 'zahnbuerste', 'deo', 'seife', 'creme', 'rasierer', 'kosmetik'] },
    { category: 'Nonfood', terms: ['pinsel', 'verbandtasche', 'fussmatte', 'fußmatte', 'katzenfutter', 'katzenstreu', 'batterie', 'lampe'] },
    { category: 'Getränke', terms: ['saft', 'cola', 'pepsi', 'wasser', 'limonade', 'sprite', 'fanta', 'bier', 'getränk', 'getraenk'] },
    { category: 'Tee/Kaffee', terms: ['tee', 'kaffee', 'espresso', 'cappuccino'] },
    { category: 'Brot/Gebäck', terms: ['brot', 'brötchen', 'broetchen', 'baguette', 'toast', 'kuchen', 'torte', 'croissant', 'apfeltasche'] },
    { category: 'Schokolade/Naschen', terms: ['schokolade', 'gummi', 'haribo', 'chips', 'keks', 'bonbon', 'mandel', 'nuss', 'nüsse', 'nuesse', 'sonnenblumenkern', 'kokosraspel'] },
    { category: 'Wurst/Salate/Teigwaren', terms: ['aufschnitt', 'schinken', 'salami', 'leberwurst', 'würst', 'wuerst', 'bacon', 'speck', 'frikadelle', 'fleischsalat', 'eiersalat', 'kartoffelsalat', 'geflügelsalat', 'gefluegelsalat', 'blätterteig', 'blaetterteig', 'pizzateig', 'döner', 'doener'] },
    { category: 'Milchprodukte', terms: ['milch', 'joghurt', 'quark', 'käse', 'kaese', 'camembert', 'camenbert', 'feta', 'ricotta', 'parmesan', 'gouda', 'sahne', 'butter', 'brunch', 'ei', 'eier'] },
    { category: 'Fleisch/Fisch', terms: ['fleisch', 'hack', 'steak', 'gulasch', 'roulade', 'hähnchen', 'haehnchen', 'kassler', 'lachs', 'fisch', 'sushi'] },
    { category: 'Obst/Gemüse', terms: ['apfel', 'äpfel', 'aepfel', 'banane', 'mango', 'melone', 'nektarine', 'beere', 'avocado', 'karotte', 'möhre', 'moehre', 'gurke', 'tomate', 'paprika', 'zucchini', 'salat', 'rosenkohl', 'kartoffel', 'zwiebel', 'knoblauch', 'zitrone', 'orange', 'obst', 'gemüse', 'gemuese', 'dill', 'petersilie'] },
];

const QUANTITY_UNITS = [
    'stück', 'stueck', 'packung', 'packungen', 'paket', 'pakete', 'flasche', 'flaschen',
    'dose', 'dosen', 'becher', 'glas', 'gläser', 'glaeser', 'kg', 'kilo', 'kilogramm', 'g', 'gramm',
    'l', 'liter', 'ml', 'milliliter', 'bund', 'netz', 'schachtel', 'schachteln', 'rolle', 'rollen',
    'kiste', 'kisten', 'karton', 'kartons', 'tüte', 'tuete', 'tüten', 'tueten', 'sack', 'säcke', 'saecke',
];

const NUMBER_WORDS = [
    'ein', 'eine', 'einen', 'einem', 'einer', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'fuenf',
    'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'zwoelf', 'dreizehn', 'vierzehn',
    'fünfzehn', 'fuenfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn', 'zwanzig',
];

export function normalize(text: string): string {
    return String(text || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('de-DE');
}

export function normalizeLoose(text: string): string {
    return normalize(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function splitAliases(value?: string): string[] {
    return String(value || '')
        .split(/[;,]/)
        .map(alias => normalize(alias))
        .filter(Boolean);
}

function unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
}

function defaultAliasesForMarket(name: string): string[] {
    const key = normalizeLoose(name);
    if (key === 'aldi') return ['aldi', 'aldi nord', 'aldi süd', 'aldi sued'];
    if (key === 'lidl') return ['lidl'];
    if (key === 'rewe') return ['rewe', 'rewe markt', 'rewe center'];
    if (key === 'penny') return ['penny', 'penny markt'];
    return [];
}

export function marketAliases(markets: MarketConfig[]): Array<{ market: string; alias: string }> {
    const result: Array<{ market: string; alias: string }> = [];

    for (const market of markets) {
        if (market.enabled === false || !market.name) continue;
        const aliases = unique([
            normalize(market.name),
            ...splitAliases(market.aliases),
            ...defaultAliasesForMarket(market.name).map(normalize),
        ]);
        for (const alias of aliases) result.push({ market: market.name, alias });
    }

    return result.sort((a, b) => b.alias.length - a.alias.length);
}

export function resolveMarket(value: string | undefined, markets: MarketConfig[]): string | undefined {
    const wanted = normalize(value || '');
    if (!wanted) return undefined;

    for (const entry of marketAliases(markets)) {
        if (entry.alias === wanted) return entry.market;
    }
    return undefined;
}

function extractMarket(text: string, markets: MarketConfig[]): { productText: string; market?: string; explicit: boolean; ambiguousMarketSuffix?: string } {
    const normalized = normalize(text);

    for (const entry of marketAliases(markets)) {
        const patterns = [` von ${entry.alias}`, ` bei ${entry.alias}`];
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

    const ambiguous = text.match(/\s+(?:von|bei)\s+(.+?)\s*$/i);
    return {
        productText: text.trim(),
        explicit: false,
        ambiguousMarketSuffix: ambiguous?.[1]?.trim(),
    };
}

export interface QuantityResult {
    productText: string;
    prefix: string;
}

export function stripQuantityDetailed(text: string): QuantityResult {
    const original = String(text || '').trim();
    if (!original) return { productText: '', prefix: '' };

    // Product names such as "1/2 Pfeiffer Leberwurst" are intentionally not treated as quantities.
    if (/^\d+\s*\/\s*\d+\s+/.test(original)) return { productText: original, prefix: '' };

    const units = QUANTITY_UNITS.join('|');
    const words = NUMBER_WORDS.join('|');
    const patterns: RegExp[] = [
        new RegExp(`^(?:ein\\s+)?(?:halbes|halbe|halb)\\s+(?:${units})\\s+`, 'i'),
        new RegExp(`^(?:${words})\\s+(?:${units})\\s+`, 'i'),
        new RegExp(`^(?:${words})\\s+`, 'i'),
        new RegExp(`^\\d+(?:[.,]\\d+)?\\s*[xX]\\s*(?:\\d+(?:[.,]\\d+)?\\s*(?:${units})\\s*)?`, 'i'),
        new RegExp(`^\\d+(?:[.,]\\d+)?\\s*(?:${units})\\s+`, 'i'),
        /^\d+(?:[.,]\d+)?\s+/i,
    ];

    for (const pattern of patterns) {
        const match = original.match(pattern);
        if (match && match[0] && match[0].length < original.length) {
            return {
                productText: original.slice(match[0].length).trim(),
                prefix: match[0].trim(),
            };
        }
    }

    return { productText: original, prefix: '' };
}

export function stripQuantity(text: string): string {
    return stripQuantityDetailed(text).productText;
}

function stemKey(text: string): string {
    let key = normalizeLoose(text).replace(/\s+/g, '');
    if (key.length > 6 && key.endsWith('en')) key = key.slice(0, -1); // Bananen -> banane
    else if (key.length > 6 && key.endsWith('n')) key = key.slice(0, -1);
    return key;
}

export function canonicalProductKey(text: string): string {
    return stemKey(stripQuantity(text));
}

function productCandidates(text: string): string[] {
    const detailed = stripQuantityDetailed(text);
    return unique([
        normalize(text),
        normalize(detailed.productText),
        canonicalProductKey(text),
        canonicalProductKey(detailed.productText),
    ]);
}

export function findProduct(text: string, products: ProductConfig[]): ProductConfig | undefined {
    const candidates = productCandidates(text);

    for (const product of products) {
        const aliases = [product.name, ...splitAliases(product.aliases)]
            .flatMap(alias => [normalize(alias), canonicalProductKey(alias)])
            .filter(Boolean);
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

function significantTokens(text: string): string[] {
    return normalizeLoose(text)
        .split(' ')
        .filter(token => token.length >= 4)
        .map(token => token.endsWith('en') && token.length > 6 ? token.slice(0, -1) : token);
}

export function guessCategorySmart(text: string, products: ProductConfig[]): string {
    const ruleGuess = guessCategory(text);
    if (ruleGuess !== 'Sonstiges') return ruleGuess;

    const tokens = significantTokens(stripQuantity(text));
    if (!tokens.length) return ruleGuess;

    const scores = new Map<string, number>();
    for (const product of products) {
        const knownTokens = significantTokens([product.name, product.aliases || ''].join(' '));
        const overlap = tokens.filter(token => knownTokens.includes(token)).length;
        if (overlap > 0) scores.set(product.category, (scores.get(product.category) || 0) + overlap);
    }

    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    return ranked[0]?.[0] || ruleGuess;
}

export function parseMarketList(value: string | string[] | undefined, markets: MarketConfig[]): string[] {
    const rawEntries = Array.isArray(value)
        ? value.flatMap(entry => String(entry || '').split(/[;,]/))
        : String(value || '').split(/[;,]/);
    const entries = rawEntries
        .map(entry => resolveMarket(String(entry || '').trim(), markets))
        .filter((entry): entry is string => Boolean(entry));
    return unique(entries);
}

function resolveProductMarket(
    product: ProductConfig | undefined,
    markets: MarketConfig[],
    fallbackMarket: string,
    priorityMarket: string,
): string {
    const productDefaultMarket = resolveMarket(product?.defaultMarket, markets);
    if (productDefaultMarket) return productDefaultMarket;

    const available = parseMarketList(product?.availableMarkets, markets);
    const resolvedPriorityMarket = resolveMarket(priorityMarket, markets);
    if (resolvedPriorityMarket && (!available.length || available.includes(resolvedPriorityMarket))) {
        return resolvedPriorityMarket;
    }

    if (available.length) {
        const order = new Map(markets.map(market => [market.name, Number(market.order) || 9999]));
        return [...available].sort((a, b) => (order.get(a) || 9999) - (order.get(b) || 9999))[0];
    }

    return resolveMarket(fallbackMarket, markets) || fallbackMarket;
}

export function parseItem(
    originalText: string,
    markets: MarketConfig[],
    products: ProductConfig[],
    fallbackMarket: string,
    priorityMarket = '',
): ParsedItem {
    const marketResult = extractMarket(originalText, markets);
    const quantity = stripQuantityDetailed(marketResult.productText);
    const product = findProduct(marketResult.productText, products);
    const productText = quantity.productText;
    const ambiguousUnknownMarketSuffix = !marketResult.market && !product && Boolean(marketResult.ambiguousMarketSuffix);

    return {
        originalText,
        productText,
        productName: product?.name || productText || marketResult.productText,
        market:
            marketResult.market ||
            (!ambiguousUnknownMarketSuffix
                ? resolveProductMarket(product, markets, fallbackMarket, priorityMarket)
                : (resolveMarket(fallbackMarket, markets) || fallbackMarket)),
        category: product?.category || guessCategorySmart(marketResult.productText, products),
        knownProduct: Boolean(product),
        explicitMarket: marketResult.explicit,
        quantityPrefix: quantity.prefix,
        ambiguousMarketSuffix: ambiguousUnknownMarketSuffix ? marketResult.ambiguousMarketSuffix : undefined,
    };
}

export function suggestAliases(observedProductText: string, product: ProductConfig): string[] {
    const observed = stripQuantity(observedProductText).trim();
    if (!observed) return [];
    const existing = [product.name, ...splitAliases(product.aliases)].map(normalize);
    if (existing.includes(normalize(observed))) return [];
    if (canonicalProductKey(observed) === canonicalProductKey(product.name)) return [observed];
    return [];
}
