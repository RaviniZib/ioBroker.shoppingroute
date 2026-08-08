"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalize = normalize;
exports.normalizeLoose = normalizeLoose;
exports.splitAliases = splitAliases;
exports.marketAliases = marketAliases;
exports.resolveMarket = resolveMarket;
exports.stripQuantityDetailed = stripQuantityDetailed;
exports.stripQuantity = stripQuantity;
exports.canonicalProductKey = canonicalProductKey;
exports.findProduct = findProduct;
exports.guessCategory = guessCategory;
exports.guessCategorySmart = guessCategorySmart;
exports.parseMarketList = parseMarketList;
exports.parseItem = parseItem;
exports.suggestAliases = suggestAliases;
const CATEGORY_RULES = [
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
function normalize(text) {
    return String(text || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('de-DE');
}
function normalizeLoose(text) {
    return normalize(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
function splitAliases(value) {
    return String(value || '')
        .split(/[;,]/)
        .map(alias => normalize(alias))
        .filter(Boolean);
}
function unique(values) {
    return [...new Set(values.filter(Boolean))];
}
function defaultAliasesForMarket(name) {
    const key = normalizeLoose(name);
    if (key === 'aldi')
        return ['aldi', 'aldi nord', 'aldi süd', 'aldi sued'];
    if (key === 'lidl')
        return ['lidl'];
    if (key === 'rewe')
        return ['rewe', 'rewe markt', 'rewe center'];
    if (key === 'penny')
        return ['penny', 'penny markt'];
    return [];
}
function marketAliases(markets) {
    const result = [];
    for (const market of markets) {
        if (market.enabled === false || !market.name)
            continue;
        const aliases = unique([
            normalize(market.name),
            ...splitAliases(market.aliases),
            ...defaultAliasesForMarket(market.name).map(normalize),
        ]);
        for (const alias of aliases)
            result.push({ market: market.name, alias });
    }
    return result.sort((a, b) => b.alias.length - a.alias.length);
}
function resolveMarket(value, markets) {
    const wanted = normalize(value || '');
    if (!wanted)
        return undefined;
    for (const entry of marketAliases(markets)) {
        if (entry.alias === wanted)
            return entry.market;
    }
    return undefined;
}
function extractMarket(text, markets) {
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
function stripQuantityDetailed(text) {
    const original = String(text || '').trim();
    if (!original)
        return { productText: '', prefix: '' };
    // Product names such as "1/2 Pfeiffer Leberwurst" are intentionally not treated as quantities.
    if (/^\d+\s*\/\s*\d+\s+/.test(original))
        return { productText: original, prefix: '' };
    const units = QUANTITY_UNITS.join('|');
    const words = NUMBER_WORDS.join('|');
    const patterns = [
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
function stripQuantity(text) {
    return stripQuantityDetailed(text).productText;
}
function stemKey(text) {
    let key = normalizeLoose(text).replace(/\s+/g, '');
    if (key.length > 6 && key.endsWith('en'))
        key = key.slice(0, -1); // Bananen -> banane
    else if (key.length > 6 && key.endsWith('n'))
        key = key.slice(0, -1);
    return key;
}
function canonicalProductKey(text) {
    return stemKey(stripQuantity(text));
}
function productCandidates(text) {
    const detailed = stripQuantityDetailed(text);
    return unique([
        normalize(text),
        normalize(detailed.productText),
        canonicalProductKey(text),
        canonicalProductKey(detailed.productText),
    ]);
}
function findProduct(text, products) {
    const candidates = productCandidates(text);
    for (const product of products) {
        const aliases = [product.name, ...splitAliases(product.aliases)]
            .flatMap(alias => [normalize(alias), canonicalProductKey(alias)])
            .filter(Boolean);
        if (candidates.some(candidate => aliases.includes(candidate)))
            return product;
    }
    return undefined;
}
function guessCategory(text) {
    const value = normalize(stripQuantity(text));
    for (const rule of CATEGORY_RULES) {
        if (rule.terms.some(term => value.includes(term)))
            return rule.category;
    }
    return 'Sonstiges';
}
function significantTokens(text) {
    return normalizeLoose(text)
        .split(' ')
        .filter(token => token.length >= 4)
        .map(token => token.endsWith('en') && token.length > 6 ? token.slice(0, -1) : token);
}
function guessCategorySmart(text, products) {
    const ruleGuess = guessCategory(text);
    if (ruleGuess !== 'Sonstiges')
        return ruleGuess;
    const tokens = significantTokens(stripQuantity(text));
    if (!tokens.length)
        return ruleGuess;
    const scores = new Map();
    for (const product of products) {
        const knownTokens = significantTokens([product.name, product.aliases || ''].join(' '));
        const overlap = tokens.filter(token => knownTokens.includes(token)).length;
        if (overlap > 0)
            scores.set(product.category, (scores.get(product.category) || 0) + overlap);
    }
    const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
    return ranked[0]?.[0] || ruleGuess;
}
function parseMarketList(value, markets) {
    const entries = String(value || '')
        .split(/[;,]/)
        .map(entry => resolveMarket(entry.trim(), markets))
        .filter((entry) => Boolean(entry));
    return unique(entries);
}
function resolveProductMarket(product, markets, fallbackMarket, priorityMarket) {
    const productDefaultMarket = resolveMarket(product?.defaultMarket, markets);
    if (productDefaultMarket)
        return productDefaultMarket;
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
function parseItem(originalText, markets, products, fallbackMarket, priorityMarket = '') {
    const marketResult = extractMarket(originalText, markets);
    const quantity = stripQuantityDetailed(marketResult.productText);
    const product = findProduct(marketResult.productText, products);
    const productText = quantity.productText;
    const ambiguousUnknownMarketSuffix = !marketResult.market && !product && Boolean(marketResult.ambiguousMarketSuffix);
    return {
        originalText,
        productText,
        productName: product?.name || productText || marketResult.productText,
        market: marketResult.market ||
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
function suggestAliases(observedProductText, product) {
    const observed = stripQuantity(observedProductText).trim();
    if (!observed)
        return [];
    const existing = [product.name, ...splitAliases(product.aliases)].map(normalize);
    if (existing.includes(normalize(observed)))
        return [];
    if (canonicalProductKey(observed) === canonicalProductKey(product.name))
        return [observed];
    return [];
}
//# sourceMappingURL=parser.js.map